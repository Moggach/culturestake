import httpStatus from 'http-status';
import request from 'supertest';

import { initializeDatabase } from './helpers/database';
import artworksData from './data/artworks';
import answersData from './data/answers';

import app from '~/server';
import web3 from '~/common/services/web3';
import {
  getAdminContract,
  getQuestionContract,
} from '~/common/services/contracts';
import createSupertest from './helpers/supertest';
import { packBooth, packVote } from '~/common/services/encoding';
import initQuestion from './helpers/initQuestion';
import initAnswer from './helpers/initAnswer';
import buildVote from './helpers/buildVote';
import { refreshNonce } from './helpers/refreshNonce';

describe('API', () => {
  let authRequest;
  let answer;
  let admin;
  let question;
  let sender;
  let booth;
  let nonce;
  let vote;

  beforeAll(async () => {
    // add test data
    await initializeDatabase();
    authRequest = await createSupertest();
    await authRequest.put('/api/artworks').send(artworksData.davinci);

    // set up question contract
    admin = getAdminContract(process.env.ADMIN_CONTRACT);
    const questionAddress = await initQuestion(
      admin,
      'festival',
      'my question',
    );
    question = getQuestionContract(questionAddress);

    // add answer to api
    await authRequest.put('/api/answers').send(answersData.artworkAnswer);

    // use chainId from api to create answer on blockchain
    answer = await initAnswer(question, 1);

    // accounts for voting
    sender = web3.eth.accounts.create();
    booth = web3.eth.accounts.privateKeyToAccount(
      `0x${process.env.BOOTH_PRIV_KEY}`,
    );

    const answers = [answer.id];
    const votes = [1];
    vote = buildVote(booth, sender, question, answers, votes);
  });

  afterAll(async () => {
    await authRequest.del('/api/artworks/mona-lisa');
    await authRequest.del('/api/answers/1');
  });

  describe('POST /api/vote', () => {
    it('should succesfully vote', async () => {
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.OK);
    });

    it('should return bad request when answer id not in database', async () => {
      vote.signature = web3.eth.accounts.sign(
        packVote([2], [1]),
        sender.privateKey,
      ).signature;
      vote.answers = [2];
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when invalid booth', async () => {
      vote.booth = sender.address;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when invalid booth signature', async () => {
      const falseBooth = web3.eth.accounts.create();
      vote.boothSignature = web3.eth.accounts.sign(
        packBooth([answer.id], nonce),
        falseBooth.privateKey,
      ).signature;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when invalid sender signature', async () => {
      const falseSender = web3.eth.accounts.create();
      vote.signature = web3.eth.accounts.sign(
        packVote([answer.id], [1]),
        falseSender.privateKey,
      ).signature;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when sender has already voted', async () => {
      await request(app)
        .post('/api/vote')
        .send(vote);
      vote.nonce = refreshNonce();
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when nonce has already been used', async () => {
      await request(app)
        .post('/api/vote')
        .send(vote);
      sender = web3.eth.accounts.create();
      vote.signature = web3.eth.accounts.sign(
        packVote([answer.id], [1]),
        sender.privateKey,
      ).signature;
      vote.sender = sender.address;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when invalid question', async () => {
      vote.question = web3.eth.accounts.create().address;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when invalid festival', async () => {
      vote.festival = web3.utils.sha3('not a valid festival');
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when sending too many votes', async () => {
      vote.voteTokens = [1000];
      vote.signature = web3.eth.accounts.sign(
        packVote([answer.id], vote.voteTokens),
        sender.privateKey,
      ).signature;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when sending too many vote items', async () => {
      vote.voteTokens = [1, 1];
      vote.signature = web3.eth.accounts.sign(
        packVote([answer.id], vote.voteTokens),
        sender.privateKey,
      ).signature;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return bad request when sending duplicates in answers array', async () => {
      vote.voteTokens = [1, 1];
      vote.signature = web3.eth.accounts.sign(
        packVote([answer.id, answer.id], vote.voteTokens),
        sender.privateKey,
      ).signature;
      await request(app)
        .post('/api/vote')
        .send(vote)
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
