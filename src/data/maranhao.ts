export const MARANHAO_REVISION = 'ma20261016';
export const maranhaoAreas = [
  {name:'Direito Penal', prefix:'map', count:4},
  {name:'Direito Processual Penal', prefix:'mapp', count:5},
  {name:'Direito Administrativo', prefix:'maadm', count:7},
  {name:'Direito Constitucional', prefix:'macon', count:7},
  {name:'Direito Ambiental', prefix:'maamb', count:2},
  {name:'Direito Civil', prefix:'maciv', count:5},
  {name:'Direito Processual Civil', prefix:'macpc', count:3},
];
export function getMaranhaoExamInfo(id: string) {
 const area=maranhaoAreas.find(area=>Array.from({length:area.count},(_,i)=>`${area.prefix}-${String(i+1).padStart(2,'0')}`).includes(id));
 if(!area) return null;
 const number=Number(id.split('-')[1]);
 return {...area,number,previousId:number>1?`${area.prefix}-${String(number-1).padStart(2,'0')}`:null,
  ids:Array.from({length:area.count},(_,i)=>`${area.prefix}-${String(i+1).padStart(2,'0')}`)};
}
