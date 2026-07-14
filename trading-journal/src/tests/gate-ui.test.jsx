import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TradeTickets from '../components/TradeTickets.jsx';

afterEach(cleanup);

function renderForm() {
  const doc = { tickets: [], dailies: [], principles: [] };
  render(<TradeTickets doc={doc} upsertTicket={() => {}} deleteTicket={() => {}} />);
  fireEvent.click(screen.getByText('+ New Ticket'));
}

describe('GATE 2 — grade-before-P&L (rendered UI)', () => {
  it('renders the P&L input disabled/blurred until a grade is committed', () => {
    renderForm();
    const pnl = screen.getByTestId('pnl-input');
    // Locked: input is non-editable and visually blurred.
    expect(pnl.disabled).toBe(true);
    expect(pnl.closest('.blurred')).not.toBeNull();
    expect(screen.getByText(/P&L locked/i)).toBeTruthy();
  });

  it('reveals and enables the P&L input after Commit Grade', () => {
    renderForm();

    // Pick a process grade. The grade <select> is the one containing option "A".
    const selects = Array.from(document.querySelectorAll('select'));
    const gradeSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === 'A')
    );
    fireEvent.change(gradeSelect, { target: { value: 'B' } });

    fireEvent.click(screen.getByText('Commit Grade'));

    const pnl = screen.getByTestId('pnl-input');
    expect(pnl.disabled).toBe(false);
    expect(pnl.closest('.blurred')).toBeNull();
  });
});
