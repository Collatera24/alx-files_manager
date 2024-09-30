/* eslint-disable */

import apiHelper from './apiHelper';
import { expect } from 'chai';

describe('Status Endpoints', () => {
	it('should return status 200 and Redis/DB status', async () => {
		const res = await apiHelper.get('/status');
		expect(res.status).to.equal(200);
		expect(res.body).to.have.keys(['redis', 'db']);
	});
});
