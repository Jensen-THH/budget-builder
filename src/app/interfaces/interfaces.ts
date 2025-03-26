export interface Category {
    name: string;
    subCategories: SubCategory[];
}

export interface SubCategory {
    name: string;
    values: number[]
}

export interface BudgetState {
    startDate: Date;
    endDate: Date;
    income: Category[];
    expenses: Category[];
    openingBalance: number;
}