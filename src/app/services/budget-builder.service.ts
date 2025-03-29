import { Injectable, Signal, computed, effect, signal } from '@angular/core';

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
            const totals = values.slice();
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

    incomeCategories = signal<Category[]>([
        new Category('General Income', 12),
        new Category('Other Income', 12),
    ]);
    expenseCategories = signal<Category[]>([
        new Category('Operational Expenses', 12),
        new Category('Salaries & Wages', 12),
    ]);

    incomeTotal = computed(() => {
        const totals = new Array(this.months().length).fill(0);
        this.incomeCategories().forEach(cat => {
            const catTotals = cat.total();
            for (let i = 0; i < totals.length; i++) {
                totals[i] += catTotals[i];
            }
        });
        return totals;
    });

    expenseTotal = computed(() => {
        const totals = new Array(this.months().length).fill(0);
        this.expenseCategories().forEach(cat => {
            const catTotals = cat.total();
            for (let i = 0; i < totals.length; i++) {
                totals[i] += catTotals[i];
            }
        });
        return totals;
    });

    profitLoss = computed(() => {
        const income = this.incomeTotal();
        const expenses = this.expenseTotal();
        return income.map((inc, i) => inc - expenses[i]);
    });

    openingBalance = computed(() => {
        const balances = [0];
        const pl = this.profitLoss();
        for (let i = 1; i < this.months().length; i++) {
            balances[i] = balances[i - 1] + pl[i - 1];
        }
        return balances;
    });

    closingBalance = computed(() => {
        const opening = this.openingBalance();
        const pl = this.profitLoss();
        return opening.map((open, i) => open + pl[i]);
    });

    updateDateRange(start: Date, end: Date) {
        this.startPeriod.set(start);
        this.endPeriod.set(end);
        const monthCount = this.months().length;
        this.incomeCategories().forEach(cat => this.resizeValues(cat, monthCount));
        this.expenseCategories().forEach(cat => this.resizeValues(cat, monthCount));
    }

    private resizeValues(category: Category, monthCount: number) {
        const current = category.values();
        const newValues = new Array(monthCount).fill(0);
        for (let i = 0; i < Math.min(current.length, monthCount); i++) {
            newValues[i] = current[i];
        }
        category.values.set(newValues);
        category.subcategories().forEach(sub => this.resizeValues(sub, monthCount));
    }

    addParentCategory(type: 'income' | 'expense', name: string) {
        const monthCount = this.months().length;
        const newCategory = new Category(name, monthCount);
        if (type === 'income') {
            this.incomeCategories.update(cats => [...cats, newCategory]);
        } else {
            this.expenseCategories.update(cats => [...cats, newCategory]);
        }
    }

    addSubcategory(parent: Category, name: string) {
        const monthCount = this.months().length;
        const newSubcategory = new Category(name, monthCount);
        parent.subcategories.update(subs => [...subs, newSubcategory]);
    }

    deleteCategory(type: 'income' | 'expense', index: number) {
        if (type === 'income') {
            this.incomeCategories.update(cats => cats.filter((_, i) => i !== index));
        } else {
            this.expenseCategories.update(cats => cats.filter((_, i) => i !== index));
        }
    }

    deleteSubcategory(parent: Category, index: number) {
        parent.subcategories.update(subs => subs.filter((_, i) => i !== index));
    }
}