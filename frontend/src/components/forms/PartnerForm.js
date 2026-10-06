import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FormActions from '../FormActions';
import FormField from '../FormField';
import {
  createCustomer,
  createSupplier,
  updateCustomer,
  updateSupplier,
} from '../../services/records';
import { isSessionError } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme';

export const partnerFields = {
  customers: {
    singular: 'cliente',
    fields: ['name', 'taxId', 'email', 'phone', 'address', 'city', 'state', 'postalCode'],
  },
  suppliers: {
    singular: 'proveedor',
    fields: ['name', 'taxId', 'email', 'phone', 'address', 'contact'],
  },
};

export const partnerFieldDefinitions = {
  name: {
    label: 'Nombre o razón social',
    placeholder: 'Ej.: Distribuidora Norte',
    required: true,
    maxLength: 160,
  },
  taxId: {
    label: 'RFC / identificación fiscal',
    placeholder: 'Opcional',
    autoCapitalize: 'characters',
    maxLength: 30,
  },
  email: {
    label: 'Correo electrónico',
    placeholder: 'contacto@empresa.com',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    maxLength: 160,
  },
  phone: {
    label: 'Teléfono',
    placeholder: 'Ej.: 55 1234 5678',
    keyboardType: 'phone-pad',
    maxLength: 30,
  },
  address: {
    label: 'Dirección',
    placeholder: 'Calle y número',
    maxLength: 300,
  },
  city: {
    label: 'Ciudad',
    placeholder: 'Ciudad',
    maxLength: 100,
  },
  state: {
    label: 'Estado',
    placeholder: 'Estado',
    maxLength: 100,
  },
  postalCode: {
    label: 'Código postal',
    placeholder: 'Código postal',
    maxLength: 15,
  },
  contact: {
    label: 'Persona de contacto',
    placeholder: 'Nombre de contacto',
    maxLength: 160,
  },
};

function initialValues(fields, record) {
  return Object.fromEntries(fields.map((field) => [field, record?.[field] ?? '']));
}

function validate(values, resource) {
  if (!values.name.trim()) return 'El nombre o razón social es obligatorio.';
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return 'Ingresa un correo electrónico válido.';
  }

  for (const field of resource.fields) {
    const maxLength = partnerFieldDefinitions[field].maxLength;
    if (values[field].trim().length > maxLength) {
      return `${partnerFieldDefinitions[field].label} no puede exceder ${maxLength} caracteres.`;
    }
  }

  return null;
}

export default function PartnerForm({
  resource: resourceName,
  record = null,
  token,
  onCancel,
  onDone,
  onSessionExpired,
}) {
  const resource = partnerFields[resourceName];
  const [values, setValues] = useState(() =>
    initialValues(resource.fields, record)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const isEditing = Boolean(record?._id);

  function changeField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  async function submit() {
    const validationError = validate(values, resource);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = Object.fromEntries(
      resource.fields.map((field) => [
        field,
        field === 'taxId'
          ? values[field].trim().toUpperCase()
          : values[field].trim(),
      ])
    );

    try {
      if (isEditing) {
        const update = resourceName === 'customers' ? updateCustomer : updateSupplier;
        await update(token, record._id, payload);
      } else {
        const create = resourceName === 'customers' ? createCustomer : createSupplier;
        await create(token, payload);
      }

      const label = resource.singular;
      onDone(
        `${label.charAt(0).toUpperCase()}${label.slice(1)} ${isEditing ? 'actualizado' : 'creado'} correctamente.`,
        'success'
      );
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setError(
        requestError?.message ??
          `No fue posible ${isEditing ? 'actualizar' : 'crear'} el ${resource.singular}.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        Los campos marcados con * son obligatorios. La empresa se asigna
        automáticamente según la sesión activa.
      </Text>

      {resource.fields.map((field) => {
        const definition = partnerFieldDefinitions[field];

        return (
          <FormField
            key={field}
            label={definition.label}
            value={values[field]}
            onChangeText={(value) => changeField(field, value)}
            placeholder={definition.placeholder}
            keyboardType={definition.keyboardType}
            autoCapitalize={definition.autoCapitalize}
            autoCorrect={definition.autoCorrect}
            maxLength={definition.maxLength}
            isRequired={definition.required}
            editable={!submitting}
          />
        );
      })}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FormActions
        onSubmit={submit}
        onCancel={onCancel}
        submitLabel={isEditing ? 'Guardar cambios' : 'Guardar'}
        submitting={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },

  sectionNote: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: colors.pastelPink,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },
});
