import test from 'node:test';
import assert from 'node:assert/strict';
import {addMonths,monthlyDueDate,plannedMonths} from '../functions/_lib/recurring.ts';
test('recorrência cruza o ano corretamente',()=>{
 assert.deepEqual(plannedMonths('2026-11',6),['2026-11','2026-12','2027-01','2027-02','2027-03','2027-04']);
});
test('dia 10 continua igual quando a data cai no fim de semana',()=>{
 assert.equal(monthlyDueDate('2026-11',10),'2026-11-10');
 assert.equal(addMonths('2026-12',2),'2027-02');
});
test('rejeita competência e número de parcelas inválidos',()=>{
 assert.throws(()=>plannedMonths('2026-13',6));
 assert.throws(()=>plannedMonths('2026-11',37));
 assert.throws(()=>monthlyDueDate('2026-11',31));
});
