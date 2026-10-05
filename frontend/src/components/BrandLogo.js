import { Image } from 'react-native';

export default function BrandLogo({
  width = 160,
  height = 56,
  accessibilityLabel = 'Logo del ERP',
}) {
  return (
    <Image
      source={require('../../assets/branding/logo.png')}
      style={{
        width,
        height,
      }}
      resizeMode="contain"
      accessible
      accessibilityLabel={accessibilityLabel}
    />
  );
}