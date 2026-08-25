import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  defaultProvider?: string;

  @IsOptional()
  @IsBoolean()
  freeOnlyDefault?: boolean;
}
