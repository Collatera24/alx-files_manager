/* eslint-disable */

import apiHelper from './apiHelper';
import { expect } from 'chai';

describe('Users Endpoints', () => {
	it('should create a new user', async () => {
		const res = await apiHelper.post('/users')
		.send({ email: 'test@example.com', password: '123456' });
		expect(res.status).to.equal(201);
		expect(res.body).to.have.property('id');
	});
});
