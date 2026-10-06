import { Router } from 'express';
import reservationRouter from './reservation.routes';
import resourceRouter from './resource.routes';

const apiRouter = Router();

apiRouter.use(resourceRouter);
apiRouter.use(reservationRouter);

export default apiRouter;
