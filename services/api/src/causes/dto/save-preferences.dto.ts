import { Equals, IsEmpty, IsOptional, IsUUID } from 'class-validator';

/**
 * PO-053 Causas Noetia preference: exactly one cause, or none (= equal split across the three causes).
 * `cause2Id` and `randomDistribution` stay declared only so requests using them are REJECTED explicitly
 * (the global ValidationPipe strips undeclared properties instead of failing): a second cause must be
 * absent/null, and random distribution, if sent, must be false.
 */
export class SavePreferencesDto {
  /** The single selected cause; null or absent = no preference (equal distribution). */
  @IsOptional()
  @IsUUID()
  cause1Id?: string | null;

  /** Not supported (PO-053): must be absent or null. */
  @IsEmpty({ message: 'Only one cause can be selected.' })
  cause2Id?: string | null;

  /** Not supported (PO-053): must be absent or false. */
  @IsOptional()
  @Equals(false, { message: 'Random distribution is not available.' })
  randomDistribution?: boolean;
}
