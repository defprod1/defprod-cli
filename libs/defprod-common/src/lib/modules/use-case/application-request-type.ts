import { z } from 'zod';

export enum ApplicationRequestType {
    command = 'command',
    query = 'query'
}

export const ApplicationRequestTypeSchema = z.nativeEnum(ApplicationRequestType).describe('Type of application request (command or query)');
