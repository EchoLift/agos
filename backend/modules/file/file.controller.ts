import { Body, Controller, Post } from '@nestjs/common';
import { AttachExternalFileDto } from './dto/attach-external-file.dto';
import { FileService } from './file.service';

@Controller({ path: 'files', version: '1' })
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('external-links')
  attachExternalLink(@Body() dto: AttachExternalFileDto) {
    return this.fileService.attachExternalLink(dto);
  }
}

