/* eslint-disable */

import apiHelper from './apiHelper';
import { expect } from 'chai';

describe('Auth Endpoints', () => {
	it('should connect the user and return a token', async () => {
		const res = await apiHelper.get('/connect')
		.set('Authorization', 'Basic dGVzdEBleGFtcGxlLmNvbToxMjM0NTY=');
		expect(res.status).to.equal(200);
		expect(res.body).to.have.property('token');
	});


	it('should disconnect the user', async () => {
		const token = '...'; // Assume token obtained previously
		const res = await apiHelper.get('/disconnect')
		.set('X-Token', token);
		expect(res.status).to.equal(204);
	});


	it('should get the user\'s details', async () => {
		const token = '...';
		const res = await apiHelper.get('/users/me')
		.set('X-Token', token);
		expect(res.status).to.equal(200);
		expect(res.body).to.have.property('id');
	});
});
