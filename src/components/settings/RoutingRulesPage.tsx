import { Navigate } from 'react-router-dom';

/** 工单分配已合并至「坐席与分配」第三步，保留旧路径兼容书签与外链 */
export default function RoutingRulesPage() {
  return <Navigate to="/settings/seats?step=3" replace />;
}
