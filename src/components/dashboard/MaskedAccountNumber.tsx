import { maskAccountNumber } from '../../utils/format';

interface MaskedAccountNumberProps {
  number: string;
  className?: string;
}

export function MaskedAccountNumber({ number, className = '' }: MaskedAccountNumberProps) {
  return (
    <span role="img" aria-label={`account ending in ${number.slice(-4)}`} className={className}>
      {maskAccountNumber(number)}
    </span>
  );
}
