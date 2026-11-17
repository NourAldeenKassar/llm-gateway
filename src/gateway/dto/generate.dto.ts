import { IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  system?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;
}
