import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  name!: string;

  @IsString()
  displayName!: string;

  @IsString()
  type!: string;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsString()
  defaultModel!: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}
