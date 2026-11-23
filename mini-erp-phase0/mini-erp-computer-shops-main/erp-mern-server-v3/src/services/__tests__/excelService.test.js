import { describe, it, expect, vi } from 'vitest';
import { generateTrialBalanceExcel } from '../excelService';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

describe('Excel Service Unit Tests', () => {
  it('should generate valid Excel file with Arabic headers', async () => {
    const mockStream = new PassThrough();
    const chunks = [];
    mockStream.on('data', (chunk) => chunks.push(chunk));

    mockStream.setHeader = vi.fn();
    mockStream.status = vi.fn().mockReturnThis();
    mockStream.send = vi.fn();

    const sampleData = {
      accounts: [{ code: '101', name: 'Test Account', debit: 100, credit: 0, balance: 100, type: 'asset' }],
      totals: { totalDebit: 100, totalCredit: 0, totalBalance: 100 },
      period: { from: '2024-01-01', to: '2024-01-31' },
    };

    // Create a promise that resolves when the stream finishes or we wait enough?
    // simple await should work if exceljs behaves.
    await generateTrialBalanceExcel(sampleData, mockStream);

    // Give it a tick to ensure stream events propagated
    await new Promise((resolve) => setTimeout(resolve, 100));

    const buffer = Buffer.concat(chunks);
    console.log('Buffer length:', buffer.length);

    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    expect(worksheet).toBeDefined();

    // Check for known header 'اسم الحساب'
    let found = false;
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && cell.value.toString().includes('اسم الحساب')) {
          found = true;
        }
      });
    });
    expect(found).toBe(true);
  });
});
