import { Injectable, Signal, computed, signal } from '@angular/core';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

export class Category {
    name = signal<string>('');
    values = signal<number[]>([]);
    subcategories = signal<Category[]>([]);
    total: Signal<number[]>;

    constructor(name: string, monthCount: number) {
        this.name.set(name);
        this.values.set(new Array(monthCount).fill(0));
        this.total = computed(() => {
            const values = this.values();
            const totals = [...values];
            const subs = this.subcategories();
            subs.forEach(sub => {
                const subTotals = sub.total();
                for (let i = 0; i < totals.length; i++) {
                    totals[i] += subTotals[i] || 0;
                }
            });
            return totals;
        });
    }
}

@Injectable({
    providedIn: 'root',
})
export class BudgetBuilderService {
    startPeriod = signal(new Date(2025, 0, 1));
    endPeriod = signal(new Date(2025, 11, 31));
    incomeCategories = signal<Category[]>([
        new Category('General Income', 12),
        new Category('Other Income', 12),
    ]);
    expenseCategories = signal<Category[]>([
        new Category('Operational Expenses', 12),
        new Category('Salaries & Wages', 12),
    ]);

    private updateTrigger$ = new BehaviorSubject<void>(undefined);

    months = computed(() => {
        const start = this.startPeriod();
        const end = this.endPeriod();
        const months: string[] = [];
        let current = new Date(start);
        while (current <= end) {
            months.push(current.toLocaleString('default', { month: 'long', year: 'numeric' }));
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    });

    private incomeCategories$ = combineLatest([
        toObservable(this.incomeCategories),
        this.updateTrigger$
    ]).pipe(map(([categories]) => categories));

    private expenseCategories$ = combineLatest([
        toObservable(this.expenseCategories),
        this.updateTrigger$
    ]).pipe(map(([categories]) => categories));

    private months$ = combineLatest([
        toObservable(this.months),
        this.updateTrigger$
    ]).pipe(map(([months]) => months));

    incomeTotal = computed(() => {
        const totals = new Array(this.months().length).fill(0);
        this.incomeCategories().forEach(cat => {
            const catTotals = cat.total();
            for (let i = 0; i < totals.length; i++) {
                totals[i] += catTotals[i] || 0;
            }
        });
        return totals;
    });

    expenseTotal = computed(() => {
        const totals = new Array(this.months().length).fill(0);
        this.expenseCategories().forEach(cat => {
            const catTotals = cat.total();
            for (let i = 0; i < totals.length; i++) {
                totals[i] += catTotals[i] || 0;
            }
        });
        return totals;
    });

    profitLoss$ = combineLatest([
        this.incomeCategories$,
        this.expenseCategories$,
        this.months$
    ]).pipe(
        map(([incomeCats, expenseCats, months]) => {
            const incomeTotals = new Array(months.length).fill(0);
            const expenseTotals = new Array(months.length).fill(0);

            incomeCats.forEach(cat => {
                const catTotals = cat.total();
                for (let i = 0; i < incomeTotals.length; i++) {
                    incomeTotals[i] += catTotals[i] || 0;
                }
            });

            expenseCats.forEach(cat => {
                const catTotals = cat.total();
                for (let i = 0; i < expenseTotals.length; i++) {
                    expenseTotals[i] += catTotals[i] || 0;
                }
            });

            return incomeTotals.map((inc, i) => inc - expenseTotals[i]);
        })
    );

    openingBalance$ = this.profitLoss$.pipe(
        map(pl => {
            const balances = [0];
            for (let i = 1; i < pl.length; i++) {
                balances[i] = balances[i - 1] + pl[i - 1];
            }
            return balances;
        })
    );

    closingBalance$ = combineLatest([this.openingBalance$, this.profitLoss$]).pipe(
        map(([opening, pl]) => opening.map((open, i) => open + pl[i]))
    );

    updateDateRange(start: Date, end: Date) {
        this.startPeriod.set(start);
        this.endPeriod.set(end);
        const monthCount = this.months().length;

        this.incomeCategories.update(cats =>
            cats.map(cat => this.resizeCategory(cat, monthCount))
        );
        this.expenseCategories.update(cats =>
            cats.map(cat => this.resizeCategory(cat, monthCount))
        );
        this.triggerUpdate();
    }

    private resizeCategory(category: Category, monthCount: number): Category {
        const currentValues = category.values();
        const newValues = new Array(monthCount).fill(0);
        for (let i = 0; i < Math.min(currentValues.length, monthCount); i++) {
            newValues[i] = currentValues[i];
        }

        const newCat = new Category(category.name(), monthCount);
        newCat.values.set(newValues);
        newCat.subcategories.set(
            category.subcategories().map(sub => this.resizeCategory(sub, monthCount))
        );
        return newCat;
    }

    addParentCategory(type: 'income' | 'expense', name: string) {
        const monthCount = this.months().length;
        const newCategory = new Category(name, monthCount);
        if (type === 'income') {
            this.incomeCategories.update(cats => [...cats, newCategory]);
        } else {
            this.expenseCategories.update(cats => [...cats, newCategory]);
        }
        this.triggerUpdate();
    }

    addSubcategory(parent: Category, name: string) {
        const monthCount = this.months().length;
        const newSubcategory = new Category(name, monthCount);
        parent.subcategories.update(subs => [...subs, newSubcategory]);
        this.triggerUpdate();
    }

    deleteCategory(type: 'income' | 'expense', index: number) {
        if (type === 'income') {
            this.incomeCategories.update(cats => cats.filter((_, i) => i !== index));
        } else {
            this.expenseCategories.update(cats => cats.filter((_, i) => i !== index));
        }
        this.triggerUpdate();
    }

    deleteSubcategory(parent: Category, index: number) {
        parent.subcategories.update(subs => subs.filter((_, i) => i !== index));
        this.triggerUpdate();
    }

    updateCategoryValues(category: Category, index: number, value: number) {
        category.values.update(values => {
            const newValues = [...values];
            newValues[index] = isNaN(value) ? 0 : value;
            return newValues;
        });
        this.triggerUpdate();
    }

    public triggerUpdate() {
        this.updateTrigger$.next();
    }
}