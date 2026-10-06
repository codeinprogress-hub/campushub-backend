import { Router } from 'express';
import { listResourcesHandler } from '../controllers/resource.controller';

const resourceRouter = Router();

resourceRouter.get('/resources', listResourcesHandler);

export default resourceRouter;
