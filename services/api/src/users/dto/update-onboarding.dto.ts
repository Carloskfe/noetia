import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { OnboardingWelcomeStatus } from '../user.entity';

const WELCOME_STATUSES: OnboardingWelcomeStatus[] = [
  'not_started',
  'in_progress',
  'skipped',
  'completed',
];

/** Partial onboarding update — the service merges these into the stored state,
 *  so a client can advance the welcome tour and/or mark a surface tutorial seen
 *  without having to send (or risk clobbering) the whole object. */
export class UpdateOnboardingDto {
  @IsOptional()
  @IsIn(WELCOME_STATUSES)
  welcome?: OnboardingWelcomeStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  welcomeStep?: number;

  /** Marks `tours[tourSeen] = true` (e.g. 'reader', 'audio', 'fragments', 'clubs'). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tourSeen?: string;
}
