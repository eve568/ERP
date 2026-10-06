import AppModal from './AppModal';
import CustomerForm from './forms/CustomerForm';
import MovementForm from './forms/MovementForm';
import ProductForm from './forms/ProductForm';
import SaleForm from './forms/SaleForm';

const forms = {
  customer: CustomerForm,
  product: ProductForm,
  movement: MovementForm,
  sale: SaleForm,
};

const subtitles = {
  customer: 'Registro rápido de un cliente en la empresa actual.',
  product: 'Alta de un producto en el catálogo de la empresa.',
  movement: 'Entrada o salida de existencias en un almacén.',
  sale: 'Venta con uno o varios productos; se guarda como borrador.',
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
        onCancel={onClose}
        onDone={onDone}
        onSessionExpired={onSessionExpired}
      />
    </AppModal>
  );
}
