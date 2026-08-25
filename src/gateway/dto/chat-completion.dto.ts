import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageDto {
  @IsString()
  role!: string;

  @IsString()
  content!: string;
}

export class ChatCompletionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages!: MessageDto[];

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  max_tokens?: number;
}
