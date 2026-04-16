import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { InfoTip, InfoTipProvider } from '@/components/game/InfoTip';

function Harness({ children, initialPath = '/' }: { children: React.ReactNode; initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <InfoTipProvider>{children}</InfoTipProvider>
    </MemoryRouter>
  );
}

describe('InfoTip', () => {
  it('opens on click and closes on Escape', async () => {
    render(
      <Harness>
        <InfoTip text="Hello help text" />
      </Harness>,
    );

    const button = screen.getByRole('button', { name: /more info/i });
    expect(screen.queryByRole('tooltip')).toBeNull();

    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hello help text');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('only one tip is open at a time across multiple instances', async () => {
    render(
      <Harness>
        <InfoTip text="First tip" />
        <InfoTip text="Second tip" />
      </Harness>,
    );

    const [btnA, btnB] = screen.getAllByRole('button', { name: /more info/i });

    await act(async () => { fireEvent.click(btnA); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('First tip');

    await act(async () => { fireEvent.click(btnB); });
    // AnimatePresence keeps the exiting tip around briefly — wait for the single visible tip to settle.
    await waitFor(() => {
      const tips = screen.getAllByRole('tooltip');
      expect(tips).toHaveLength(1);
      expect(tips[0]).toHaveTextContent('Second tip');
    });
  });

  it('links trigger to tooltip via aria-describedby when open', async () => {
    render(
      <Harness>
        <InfoTip text="Described" />
      </Harness>,
    );

    const button = screen.getByRole('button', { name: /more info/i });
    expect(button).not.toHaveAttribute('aria-describedby');

    await act(async () => { fireEvent.click(button); });

    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByRole('tooltip')).toHaveAttribute('id', describedBy!);
  });

  it('closes when the route changes', async () => {
    function Nav() {
      const navigate = useNavigate();
      return (
        <>
          <InfoTip text="Stays or goes?" />
          <button onClick={() => navigate('/elsewhere')}>go</button>
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <InfoTipProvider>
          <Routes>
            <Route path="/" element={<Nav />} />
            <Route path="/elsewhere" element={<div>other</div>} />
          </Routes>
        </InfoTipProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /more info/i }));
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go' }));
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByText('other')).toBeInTheDocument();
  });
});
