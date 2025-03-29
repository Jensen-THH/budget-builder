import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

export class Category {
  name = signal<string>('');
  values = signal<number[]>([]);
  subcategories = signal<Category[]>([]);

  total: Signal<number[]> = computed(() => {
    const totals = [...this.values()];
    this.subcategories().forEach(sub => {
      sub.total().forEach((val, i) => totals[i] += val || 0);
    });
    return totals;
  });

  constructor(name: string, monthCount: number) {
    this.name.set(name);
    this.values.set(Array(monthCount).fill(0));
  }
}

@Injectable({ providedIn: 'root' })
export class BudgetBuilderService {
  public readonly startPeriod: WritableSignal<Date> = signal(new Date(2025, 0, 1));
  public readonly endPeriod: WritableSignal<Date> = signal(new Date(2025, 11, 31));
  public readonly incomeCategories: WritableSignal<Category[]> = signal([
    new Category('General Income', 12),
    new Category('Other Income', 12),
  ]);
  public readonly expenseCategories: WritableSignal<Category[]> = signal([
    new Category('Operational Expenses', 12),
    new Category('Salaries & Wages', 12),
  ]);

  public readonly updateTrigger$ = new BehaviorSubject<void>(undefined);

  readonly months: Signal<string[]> = computed(() => {
    const start = this.startPeriod();
    const end = this.endPeriod();
    const months: string[] = [];
    for (let current = new Date(start); current <= end; current.setMonth(current.getMonth() + 1)) {
      months.push(current.toLocaleString('default', { month: 'long', year: 'numeric' }));
    }
    return months;
  });

  public readonly incomeCategories$ = combineLatest([toObservable(this.incomeCategories), this.updateTrigger$])
    .pipe(map(([categories]) => categories));
  public readonly expenseCategories$ = combineLatest([toObservable(this.expenseCategories), this.updateTrigger$])
    .pipe(map(([categories]) => categories));
  public readonly months$ = combineLatest([toObservable(this.months), this.updateTrigger$])
    .pipe(map(([months]) => months));

  readonly incomeTotal: Signal<number[]> = computed(() => this.calculateTotal(this.incomeCategories()));
  readonly expenseTotal: Signal<number[]> = computed(() => this.calculateTotal(this.expenseCategories()));

  readonly profitLoss$ = combineLatest([this.incomeCategories$, this.expenseCategories$, this.months$]).pipe(
    map(([incomeCats, expenseCats, months]) => {
      const incomeTotals = this.calculateTotalSync(incomeCats, months.length);
      const expenseTotals = this.calculateTotalSync(expenseCats, months.length);
      return incomeTotals.map((inc, i) => inc - expenseTotals[i]);
    })
  );

  readonly openingBalance$ = this.profitLoss$.pipe(
    map(pl => pl.reduce((balances, curr, i) => {
      balances.push(i === 0 ? 0 : balances[i - 1] + pl[i - 1]);
      return balances;
    }, [] as number[]))
  );

  readonly closingBalance$ = combineLatest([this.openingBalance$, this.profitLoss$]).pipe(
    map(([opening, pl]) => opening.map((open, i) => open + pl[i]))
  );

  updateDateRange(start: Date, end: Date): void {
    this.startPeriod.set(start);
    this.endPeriod.set(end);
    const monthCount = this.months().length;
    this.resizeCategories(this.incomeCategories, monthCount);
    this.resizeCategories(this.expenseCategories, monthCount);
    this.triggerUpdate();
  }

  addParentCategory(type: 'income' | 'expense', name: string): void {
    const newCategory = new Category(name, this.months().length);
    this.updateCategories(type, cats => [...cats, newCategory]);
  }

  addSubcategory(parent: Category, name: string): void {
    parent.subcategories.update(subs => [...subs, new Category(name, this.months().length)]);
    this.triggerUpdate();
  }

  deleteCategory(type: 'income' | 'expense', index: number): void {
    this.updateCategories(type, cats => cats.filter((_, i) => i !== index));
  }

  deleteSubcategory(parent: Category, index: number): void {
    parent.subcategories.update(subs => subs.filter((_, i) => i !== index));
    this.triggerUpdate();
  }

  updateCategoryValues(category: Category, index: number, value: number): void {
    category.values.update(values => values.map((v, i) => i === index ? (isNaN(value) ? 0 : value) : v));
    this.triggerUpdate();
  }

  public calculateTotal(categories: Category[]): number[] {
    const totals = Array(this.months().length).fill(0);
    categories.forEach(cat => cat.total().forEach((val, i) => totals[i] += val || 0));
    return totals;
  }

  public calculateTotalSync(categories: Category[], length: number): number[] {
    const totals = Array(length).fill(0);
    categories.forEach(cat => cat.total().forEach((val, i) => totals[i] += val || 0));
    return totals;
  }

  public resizeCategories(categoriesSignal: WritableSignal<Category[]>, monthCount: number): void {
    categoriesSignal.update((cats: Category[]) => cats.map(cat => {
      const newCat = new Category(cat.name(), monthCount);
      newCat.values.set(cat.values().slice(0, monthCount).concat(Array(Math.max(0, monthCount - cat.values().length)).fill(0)));
      newCat.subcategories.set(cat.subcategories().map(sub => this.resizeCategory(sub, monthCount)));
      return newCat;
    }));
  }

  public resizeCategory(category: Category, monthCount: number): Category {
    const newCat = new Category(category.name(), monthCount);
    newCat.values.set(category.values().slice(0, monthCount).concat(Array(Math.max(0, monthCount - category.values().length)).fill(0)));
    newCat.subcategories.set(category.subcategories().map(sub => this.resizeCategory(sub, monthCount)));
    return newCat;
  }

  public updateCategories(type: 'income' | 'expense', updateFn: (cats: Category[]) => Category[]): void {
    (type === 'income' ? this.incomeCategories : this.expenseCategories).update(updateFn);
    this.triggerUpdate();
  }

  public triggerUpdate(): void {
    this.updateTrigger$.next();
  }
}