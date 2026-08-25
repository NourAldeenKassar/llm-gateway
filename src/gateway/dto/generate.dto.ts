import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  system?: string;

  @IsOptional()
  @IsBoolean()
  freeOnly?: boolean;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;
}
