import { z } from 'zod';

export const AreaVisibility = {
    public: 'public',
    internal: 'internal',
    hidden: 'hidden',
} as const;

export const areaVisibilitySchema = z.enum([
    AreaVisibility.public,
    AreaVisibility.internal,
    AreaVisibility.hidden,
]);

export type AreaVisibility = z.infer<typeof areaVisibilitySchema>;

export const AreaVisibilityLabels: Record<AreaVisibility, string> = {
    [AreaVisibility.public]: 'Public',
    [AreaVisibility.internal]: 'Internal',
    [AreaVisibility.hidden]: 'Hidden',
};
