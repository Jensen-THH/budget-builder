import { Component, ElementRef, ViewChild } from '@angular/core';
import { BudgetBuilderService, Category } from '../../services/budget-builder.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css'],
})
export class TableComponent {
  @ViewChild('firstInput') firstInput?: ElementRef<HTMLInputElement>;
  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  selectedCategory!: Category;
  selectedMonthIndex!: number;

  selectedStartMonth: string = this.getMonthOfCurrentYear('01');
  selectedEndMonth: string = this.getMonthOfCurrentYear('12');
  availableMonths: { label: string; value: string }[] = this.generateAvailableMonths();

  constructor(public service: BudgetBuilderService) {}

  ngAfterViewInit() {
    this.firstInput?.nativeElement.focus();
    this.updateDateRangeFromDropdown();
  }

  private getCurrentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getMonthOfCurrentYear(month: string): string {
    const now = new Date();
    return `${now.getFullYear()}-${month}`;
  }

  private generateAvailableMonths(): { label: string; value: string }[] {
    const months: { label: string; value: string }[] = [];
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 1;
    const endYear = currentYear + 1;

    for (let year = startYear; year <= endYear; year++) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        months.push({ label, value });
      }
    }
    return months;
  }

  updateDateRangeFromDropdown() {
    const [startYear, startMonth] = this.selectedStartMonth.split('-').map(Number);
    const [endYear, endMonth] = this.selectedEndMonth.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth - 1, 31);

    if (endDate < startDate) {
      this.selectedEndMonth = this.selectedStartMonth;
      this.service.updateDateRange(startDate, startDate);
    } else {
      this.service.updateDateRange(startDate, endDate);
    }
  }

  getRowIndex(parentIdx: number, subIdx?: number, isSubcategory: boolean = false): number {
    let rowIndex = 0;
    const incomeCats = this.service.incomeCategories();

    if (parentIdx < incomeCats.length) {
      for (let i = 0; i < incomeCats.length; i++) {
        if (i < parentIdx) {
          rowIndex += 1 + incomeCats[i].subcategories.length;
        } else if (i === parentIdx) {
          rowIndex += isSubcategory && subIdx !== undefined ? subIdx + 1 : 0;
          break;
        }
      }
    } else {
      const incomeRows = incomeCats.reduce((sum, cat) => sum + 1 + cat.subcategories.length, 0);
      const expenseIdx = parentIdx - incomeCats.length;
      const expenseCats = this.service.expenseCategories();
      for (let i = 0; i < expenseCats.length; i++) {
        if (i < expenseIdx) {
          rowIndex += 1 + expenseCats[i].subcategories.length;
        } else if (i === expenseIdx) {
          rowIndex += incomeRows + (isSubcategory && subIdx !== undefined ? subIdx + 1 : 0);
          break;
        }
      }
    }
    return rowIndex;
  }

  onKeyDown(
    event: KeyboardEvent,
    cat: Category,
    monthIdx: number,
    target: EventTarget | null,
    rowIdx: number,
    isSubcategory: boolean = false,
    parentIdx?: number
  ) {
    if (!target || !(target instanceof HTMLInputElement) || parentIdx === undefined) return;

    const input = target as HTMLInputElement;
    const inputs = Array.from(document.querySelectorAll('input[data-row][data-col]')) as HTMLInputElement[];
    const currentRow = parseInt(input.dataset['row'] || '0');
    const currentCol = parseInt(input.dataset['col'] || '0');
    const maxCol = this.service.months().length - 1;
    const maxRow = this.calculateMaxRow();

    if (['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
      event.preventDefault();
    }

    switch (event.key) {
      case 'Enter':
        this.service.addSubcategory(cat, `New Subcategory`);
        setTimeout(() => {
          const newInputs = Array.from(document.querySelectorAll('input[data-row][data-col]')) as HTMLInputElement[];
          this.focusNextRow(newInputs, currentRow + 1, 0);
        }, 50);
        break;
      case 'ArrowUp':
        if (currentRow > 0) this.moveFocus(inputs, currentRow - 1, currentCol);
        break;
      case 'ArrowDown':
        if (currentRow < maxRow) this.moveFocus(inputs, currentRow + 1, currentCol);
        break;
      case 'ArrowLeft':
        if (currentCol > 0) this.moveFocus(inputs, currentRow, currentCol - 1);
        break;
      case 'ArrowRight':
        if (currentCol < maxCol) this.moveFocus(inputs, currentRow, currentCol + 1);
        break;
      case 'Tab':
        if (event.shiftKey) {
          if (currentCol > 0) {
            this.moveFocus(inputs, currentRow, currentCol - 1);
          } else if (currentRow > 0) {
            this.moveFocus(inputs, currentRow - 1, maxCol);
          }
        } else {
          if (currentCol < maxCol) {
            this.moveFocus(inputs, currentRow, currentCol + 1);
          } else if (currentRow < maxRow) {
            this.moveFocus(inputs, currentRow + 1, 0);
          }
        }
        break;
    }
  }

  private calculateMaxRow(): number {
    const incomeRows = this.service.incomeCategories().reduce((sum, cat) => sum + 1 + cat.subcategories.length, 0);
    const expenseRows = this.service.expenseCategories().reduce((sum, cat) => sum + 1 + cat.subcategories.length, 0);
    return incomeRows + expenseRows - 1;
  }

  private moveFocus(inputs: HTMLInputElement[], row: number, col: number) {
    const target = inputs.find(
      input => parseInt(input.dataset['row'] || '0') === row && parseInt(input.dataset['col'] || '0') === col
    );
    if (target) target.focus();
  }

  private focusNextRow(inputs: HTMLInputElement[], row: number, col: number) {
    const target = inputs.find(
      input => parseInt(input.dataset['row'] || '0') === row && parseInt(input.dataset['col'] || '0') === col
    );
    if (target) target.focus();
  }

  onRightClick(event: MouseEvent, cat: Category, monthIdx: number) {
    event.preventDefault();
    this.showContextMenu = true;
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.selectedCategory = cat;
    this.selectedMonthIndex = monthIdx;
  }

  applyToAll() {
    const value = this.selectedCategory.values()[this.selectedMonthIndex];
    this.selectedCategory.values.update(values => {
      const newValues = values.slice();
      newValues.fill(value);
      return newValues;
    });
    this.showContextMenu = false;
  }

  closeContextMenu() {
    this.showContextMenu = false;
  }

  updateValues(cat: Category, index: number, value: number) {
    const parsedValue = isNaN(value) ? 0 : value; 
    cat.values.update(values => {
      const newValues = [...values];
      newValues[index] = parsedValue;
    });
  }
}