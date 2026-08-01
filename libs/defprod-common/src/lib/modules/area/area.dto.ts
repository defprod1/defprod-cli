import { z } from 'zod';

/**
 * Data Transfer Object for area entity
 */
export const areaDtoSchema = z.object({
    /**
     * Unique identifier for the area
     */
    _id: z.string(),
    
    /**
     * Display ID for the area
     */
    key: z.string(),
    
    /**
     * The name of the area
     */
    name: z.string(),
    
    /**
     * Description of the area (optional)
     */
    description: z.string().optional(),

    /**
     * ID of the product this area belongs to
     */
    productId: z.string(),
    
    /**
     * Timestamp when this area was created
     */
    createdAt: z.date(),
    
    /**
     * Timestamp when this area was last updated
     */
    updatedAt: z.date(),
    
    /**
     * Sort order for display purposes
     */
    order: z.number().optional(),

});

export type AreaDto = z.infer<typeof areaDtoSchema>;
