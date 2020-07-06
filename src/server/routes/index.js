import express from 'express';
import httpStatus from 'http-status';

import APIError from '~/server/helpers/errors';
import authMiddleware from '~/server/middlewares/passport';
import authRouter from '~/server/routes/auth';
import festivalsRouter from '~/server/routes/festivals';
import questionsRouter from '~/server/routes/questions';
import artworksRouter from '~/server/routes/artworks';
import artistsRouter from '~/server/routes/artists';
import propertiesRouter from '~/server/routes/properties';
import answersRouter from '~/server/routes/answers';
import uploadsRouter from '~/server/routes/uploads';
import usersRouter from '~/server/routes/users';
import voteRouter from '~/server/routes/vote';

import { respondWithSuccess } from '~/server/helpers/respond';

const router = express.Router();

router.get('/', (req, res) => {
  respondWithSuccess(res);
});

router.use('/auth', authRouter);

router.use('/uploads', uploadsRouter);

router.use('/users', authMiddleware, usersRouter);

router.use('/vote', voteRouter);

router.use('/festivals', festivalsRouter);

router.use('/questions', questionsRouter);

router.use('/artworks', artworksRouter);

router.use('/artists', artistsRouter);

router.use('/properties', propertiesRouter);

router.use('/answers', answersRouter);

router.use(() => {
  throw new APIError(httpStatus.NOT_FOUND);
});

export default router;
