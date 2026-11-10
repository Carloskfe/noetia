import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TurnDto } from '../../../../src/knowledge/sessions/sessions.dto';

const errors = (o: object) => validateSync(plainToInstance(TurnDto, o)).map((e) => e.property);

describe('TurnDto (NEM-024 D-3 A1)', () => {
  it('requires a client key and a question string (transport bound; the service applies the 1–500 code-point rule)', () => {
    expect(errors({ idempotencyKey: 'client-key-0001', question: '¿Qué papel tiene el faro?' })).toEqual([]);
    expect(errors({ idempotencyKey: 'client-key-0001' })).toEqual(['question']);
    expect(errors({ idempotencyKey: 'client-key-0001', question: 5 })).toEqual(['question']);
    expect(errors({ idempotencyKey: 'client-key-0001', question: 'x'.repeat(4001) })).toEqual(['question']);
    expect(errors({ idempotencyKey: 'bad key', question: 'q' })).toEqual(['idempotencyKey']);
  });
});
