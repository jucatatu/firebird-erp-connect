const assert = require('assert');
const mapper = require('../src/modules/clients/clients.mapper');

describe('Clients Mapper - buildCreateContactParams', () => {
  it('should return empty strings instead of null for optional contact fields', () => {
    const personId = 123;
    const data = {
      phone: null,
      mobile: '47999999999',
      email: null
    };
    
    const result = mapper.buildCreateContactParams(personId, data);
    
    assert.deepStrictEqual(result, [
      123,
      '',
      '47999999999',
      '',
      ''
    ]);
  });

  it('should return trimmed values when all contacts are provided', () => {
    const personId = 123;
    const data = {
      phone: ' 4733700000 ',
      mobile: ' 47999999999 ',
      email: ' teste@teste.com.br '
    };
    
    const result = mapper.buildCreateContactParams(personId, data);
    
    assert.deepStrictEqual(result, [
      123,
      '4733700000',
      '47999999999',
      'teste@teste.com.br',
      ''
    ]);
  });
});
