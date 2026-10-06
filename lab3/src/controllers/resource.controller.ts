import { Request, Response } from 'express';
import { listResources } from '../services/resource.service';
import { sendFailure } from './http-response';

/** GET /resources — reads the query string, calls the service, returns 200 or 400. */
export async function listResourcesHandler(req: Request, res: Response): Promise<void> {
  try {
    const typeWasProvided = Object.prototype.hasOwnProperty.call(req.query, 'type');
    const resources = await listResources(req.query.type, typeWasProvided);
    res.status(200).json(resources);
  } catch (error: unknown) {
    sendFailure(res, error);
  }
}
