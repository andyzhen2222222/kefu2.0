/** 与「设置 - 字段管理」中退回承运商字典 id 一致，供 openFieldConfigPage 使用 */
export const RETURN_CARRIER_DICT_ID = 'return_carrier';

export type FieldDictItemSeed = {
  id: string;
  label: string;
  value: string;
  status: 'active' | 'disabled';
};

/** 字段管理页初始数据 + 提交售后下拉选项（同一数据源） */
export const RETURN_CARRIER_SEED_ITEMS: FieldDictItemSeed[] = [
  { id: 'rc1', label: 'USPS', value: 'USPS', status: 'active' },
  { id: 'rc2', label: 'UPS', value: 'UPS', status: 'active' },
  { id: 'rc3', label: 'FedEx', value: 'FedEx', status: 'active' },
  { id: 'rc4', label: 'DHL', value: 'DHL', status: 'active' },
  { id: 'rc5', label: 'Royal Mail', value: 'Royal Mail', status: 'active' },
  { id: 'rc6', label: '顺丰', value: 'SF Express', status: 'active' },
  { id: 'rc7', label: '其他', value: 'other', status: 'active' },
];
