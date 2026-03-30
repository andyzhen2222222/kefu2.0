/** 自动回复「从知识库导入」演示数据（与设置-知识库文档主题对齐，便于联调后接真实检索） */
export interface KnowledgeSnippetItem {
  id: string;
  title: string;
  body: string;
}

export const DEMO_KB_SNIPPETS_FOR_IMPORT: KnowledgeSnippetItem[] = [
  {
    id: 'kb-snippet-1',
    title: '破损商品处理政策（2026Q1）',
    body:
      '若商品在送达时已损坏，买家可申请全额退款至原支付方式，或选择免费换货。请在 48 小时内提交清晰照片作为凭证。',
  },
  {
    id: 'kb-snippet-2',
    title: '退换货 SLA 与物流说明',
    body:
      '客服应在首次接触后 24 小时内给出解决方案选项（退款/补发/部分补偿），并与买家确认。退货物流单号需在发起退货后 7 日内填写。',
  },
  {
    id: 'kb-snippet-3',
    title: '欧盟 VAT 发票开具指引',
    body:
      '企业买家需提供有效税号；个人订单按当地法规开具收据或标准发票。具体模板以店铺绑定主体为准。',
  },
];
