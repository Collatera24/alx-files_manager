/* eslint-disable */

import apiHelper from './apiHelper';
import { expect } from 'chai';

describe('Stats Endpoints', () => {
	it('should return status 200 and user/file count', async () => {
		const res = await apiHelper.get('/stats');
		expect(res.status).to.equal(200);
		expect(res.body).to.have.keys(['users', 'files']);
	});
});
