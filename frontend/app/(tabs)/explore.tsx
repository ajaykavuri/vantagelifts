import { StyleSheet, View, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient'; 
import { useRouter } from 'expo-router'; // To link to your camera view

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width } = Dimensions.get('window');

const FEATURES = [
  { id: 1, title: 'AI Form Analysis', description: 'Real-time biomechanics tracking to ensure safety.', icon: 'eye.fill', color: '#007AFF', delay: 100 },
  { id: 2, title: 'Velocity Tracking', description: 'Measure bar speed to accurately gauge RIR.', icon: 'speedometer', color: '#4CD964', delay: 200 },
  { id: 3, title: 'Proof of Sweat', description: 'Cryptographically verify your workouts.', icon: 'lock.shield.fill', color: '#FFD700', delay: 300 },
  { id: 4, title: 'Privacy Shield', description: 'On-device processing with background blurring.', icon: 'hand.raised.fill', color: '#FF3B30', delay: 400 },
];

export default function TabTwoScreen() {
  const router = useRouter();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#1A1A1A', dark: '#000' }}
      headerImage={
        <IconSymbol size={300} color="#222" name="waveform.path.ecg" style={styles.headerImage} />
      }>
      
      <ThemedView style={styles.titleContainer}>
        <Animated.View entering={FadeInDown.duration(600).springify()}>
          <ThemedText type="title" style={styles.mainTitle}>Vantage</ThemedText>
          <ThemedText style={styles.subtitle}>The Future of Hypertrophy</ThemedText>
        </Animated.View>
      </ThemedView>

      <View style={styles.featuresContainer}>
        {FEATURES.map((feature) => (
          <Animated.View key={feature.id} entering={FadeInRight.delay(feature.delay)} style={styles.cardWrapper}>
            <LinearGradient
              colors={['#2C2C2E', '#141414']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.card}
            >
              <View style={[styles.iconBox, { backgroundColor: `${feature.color}15` }]}>
                <IconSymbol size={28} name={feature.icon as any} color={feature.color} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText type="subtitle" style={styles.cardTitle}>{feature.title}</ThemedText>
                <ThemedText style={styles.cardDesc}>{feature.description}</ThemedText>
              </View>
            </LinearGradient>
          </Animated.View>
        ))}
      </View>

      {/* Modern Gradient Button */}
      <Animated.View entering={FadeInDown.delay(600)} style={styles.footer}>
        <TouchableOpacity onPress={() => router.push('/')}>
            <LinearGradient
                colors={['#007AFF', '#0055BB']}
                style={styles.ctaButton}
            >
                <ThemedText style={styles.ctaText}>Start Your Session</ThemedText>
                <IconSymbol name="arrow.right" size={20} color="white" />
            </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: { color: '#111', bottom: -50, left: -30, position: 'absolute' },
  titleContainer: { marginBottom: 10, paddingHorizontal: 10 },
  mainTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  subtitle: { fontSize: 18, color: '#888', marginTop: 4 },
  featuresContainer: { gap: 16, paddingBottom: 20 },
  cardWrapper: { borderRadius: 20, overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
  },
  iconBox: { width: 54, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#999', lineHeight: 18 },
  footer: { marginTop: 30, alignItems: 'center', paddingBottom: 50 },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 10,
    shadowColor: '#007AFF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  ctaText: { color: 'white', fontSize: 18, fontWeight: '700' },
});