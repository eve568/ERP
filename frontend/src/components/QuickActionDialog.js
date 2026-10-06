import AppModal from './AppModal';
import CustomerForm from './forms/CustomerForm';
import MovementForm from './forms/MovementForm';
import ProductForm from './forms/ProductForm';
import PurchaseForm from './forms/PurchaseForm';
import SaleForm from './forms/SaleForm';

const forms = {
  customer: CustomerForm,
  product: ProductForm,
  movement: MovementForm,
  sale: SaleForm,
  purchase: PurchaseForm,
};

const subtitles = {
  customer: 'Registro rápido de un cliente en la empresa actual.',
  product: 'Alta de un producto en el catálogo de la empresa.',
  movement: 'Entrada, salida o ajuste de existencias en un almacén.',
  sale: 'Venta con productos disponibles confirmada contra el almacén elegido.',
  purchase: 'Compra recibida con actualización de existencias del almacén.',
};

/**
 * Diálogo único para las acciones rápidas del dashboard.
 * Cada acción se conecta a su endpoint real del backend.
 */
export default function QuickActionDialog({
  action,
  visible = true,
  token,
  companyId,
  branchId,
  userRole,
  onClose,
  onDone,
  onSessionExpired,
}) {
  if (!action) {
    return null;
  }

  const Form = forms[action.key];

  if (!Form) {
    return null;
  }

  return (
    <AppModal
      visible={visible}
      title={action.title}
      subtitle={subtitles[action.key]}
      onClose={onClose}
      maxWidth={520}
    >
      <Form
        token={token}
        companyId={companyId}
        branchId={branchId}
        userRole={userRole}
        onCancel={onClose}
        onDone={onDone}
        onSessionExpired={onSessionExpired}
      />
    </AppModal>
  );
}
