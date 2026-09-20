const salaryInput = document.querySelector('#annual-salary');
const salaryForm = document.querySelector('#salary-form');
const monthlyGross = document.querySelector('#monthly-gross');
const monthlyDeduction = document.querySelector('#monthly-deduction');
const monthlyNet = document.querySelector('#monthly-net');

const won = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function numericValue(value) {
  return Number(String(value).replace(/[^0-9]/g, '')) || 0;
}

function estimateDeductionRate(annualSalary) {
  if (annualSalary <= 30_000_000) return 0.105;
  if (annualSalary <= 50_000_000) return 0.125;
  if (annualSalary <= 70_000_000) return 0.145;
  if (annualSalary <= 100_000_000) return 0.17;
  return 0.2;
}

function calculate() {
  const annual = numericValue(salaryInput.value);
  const gross = Math.round(annual / 12);
  const deduction = Math.round(gross * estimateDeductionRate(annual));
  const net = gross - deduction;

  monthlyGross.textContent = won.format(gross);
  monthlyDeduction.textContent = won.format(deduction);
  monthlyNet.textContent = won.format(net);
}

salaryInput.addEventListener('input', (event) => {
  const value = numericValue(event.target.value);
  event.target.value = value ? value.toLocaleString('ko-KR') : '';
});

salaryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  calculate();
});

document.querySelectorAll('[data-value]').forEach((button) => {
  button.addEventListener('click', () => {
    salaryInput.value = Number(button.dataset.value).toLocaleString('ko-KR');
    calculate();
  });
});

