import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdminChatDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  system?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

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
