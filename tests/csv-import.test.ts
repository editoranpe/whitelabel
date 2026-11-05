import test from 'node:test';
import assert from 'node:assert/strict';
import {membersFromCsv,chargesFromCsv,transactionsFromCsv,parseCsv} from '../src/csvImport.ts';
test('CSV exportado pelo Excel com separador ponto e vírgula e vírgula decimal',()=>{
 const {rows,errors}=membersFromCsv('Nome;E-mail;Empresa;Mensalidade\nAna Souza;ana@example.com;Negócio A;40,00\nBruno Silva;bruno@example.com;Negócio B;45,50');
 assert.equal(errors.length,0);assert.equal(rows.length,2);assert.equal(rows[0].monthly_fee_cents,4000);assert.equal(rows[1].monthly_fee_cents,4550);
});
test('CSV exportado pelo sistema preserva centavos',()=>{
 const result=membersFromCsv('Nome;E-mail;Mensalidade (centavos)\n"Celia, CIB";celia@example.com;4000');
 assert.equal(result.rows[0].monthly_fee_cents,4000);
});
test('suporta campos com aspas e quebras de linha',()=>{
 assert.deepEqual(parseCsv('Nome,Observações\n"Maria, Silva","Primeira linha\nSegunda linha"'),[['Nome','Observações'],['Maria, Silva','Primeira linha\nSegunda linha']]);
});
test('bloqueia cabeçalho sem Nome e E-mail',()=>assert.throws(()=>membersFromCsv('Empresa;Cidade\nABC;Blumenau')));

test('importa mensalidade paga com data brasileira, valor em centavos e competência',()=>{
 const {rows,errors}=chargesFromCsv('E-mail;Competência;Vencimento;Valor (centavos);Situação;Pago em\nana@example.com;11/2026;10/11/2026;4000;pago;10/11/2026');
 assert.deepEqual(errors,[]);assert.equal(rows.length,1);assert.equal(rows[0].period,'2026-11');assert.equal(rows[0].due_date,'2026-11-10');assert.equal(rows[0].status,'paid');assert.equal(rows[0].amount_cents,4000);
});
test('importa receita adicional sem duplicar mensalidade no parser',()=>{
 const {rows,errors}=transactionsFromCsv('Data;Tipo;Categoria;Descrição;Valor (centavos)\n01/11/2026;despesa;Café;Coffee break;8000');
 assert.deepEqual(errors,[]);assert.equal(rows[0].kind,'expense');assert.equal(rows[0].occurred_on,'2026-11-01');assert.equal(rows[0].amount_cents,8000);
});
