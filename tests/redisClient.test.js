/* eslint-disable */

import { expect } from 'chai';
import redisClient from '../utils/redis';

describe('Redis Client', () => {
	it('should check if Redis client is alive', async () => {
		const isAlive = redisClient.isAlive();
		expect(isAlive).to.be.true;
	});


	it('should set and get value in Redis', async () => {
		await redisClient.set('testKey', 'testValue', 10);
		const value = await redisClient.get('testKey');
		expect(value).to.equal('testValue');
	});
});
