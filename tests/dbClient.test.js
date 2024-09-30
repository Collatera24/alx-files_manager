/* eslint-disable */

import { expect } from 'chai';
import dbClient from '../utils/db';

describe('DB Client', () => {
	it('should check if DB client is alive', async () => {
		const isAlive = dbClient.isAlive();
		expect(isAlive).to.be.true;
	});


	it('should check number of users in DB', async () => {
		const nbUsers = await dbClient.nbUsers();
		expect(nbUsers).to.be.a('number');
	});
});
