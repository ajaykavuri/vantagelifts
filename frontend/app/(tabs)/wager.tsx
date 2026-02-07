import React, { useState } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Alert } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Built-in with Expo

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width } = Dimensions.get('window');

// --- MOCK DATA FOR GROUP ---
const INITIAL_GROUP = [
  { id: '1', name: 'You', matches: 3, goal: 4, avatar: 'person.circle.fill', color: '#007AFF', isMe: true },
  { id: '2', name: 'sreyya', matches: 4, goal: 5, avatar: 'p.circle.fill', color: '#FF2D55', isMe: false },
  { id: '3', name: 'KCLuo', matches: 1, goal: 4, avatar: 'g.circle.fill', color: '#5856D6', isMe: false },
  { id: '4', name: 'Anthony', matches: 2, goal: 3, avatar: 'm.circle.fill', color: '#FF9500', isMe: false },
];

export default function WagerScreen() {
  const [coins, setCoins] = useState(4); // Started with 5, minus 1 for current wager
  const [poolSize, setPoolSize] = useState(4); // 4 members * 1 coin
  const [daysLeft, setDaysLeft] = useState(2);

  // Helper to render progress bars
  const renderProgressBar = (current: number, goal: number, color: string) => {
    const progress = Math.min(current / goal, 1);
    return (
      <View style={styles.progressTrack}>
        <View 
            style={[
                styles.progressFill, 
                { width: `${progress * 100}%`, backgroundColor: color }
            ]} 
        />
      </View>
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#1A1A1A', dark: '#000' }}
      headerImage={
        <Ionicons 
            name="trophy" 
            size={280} 
            color="#FFD700" 
            style={styles.headerImage} 
        />
      }>
      
      {/* HEADER */}
      <ThemedView style={styles.titleContainer}>
        <Animated.View entering={FadeInDown.duration(600).springify()}>
          <ThemedText type="title" style={styles.mainTitle}>Weekly Wager</ThemedText>
          <ThemedText style={styles.subtitle}>Consistency pays off.</ThemedText>
        </Animated.View>
      </ThemedView>

      {/* 1. STATUS CARDS (Balance & Pool) */}
      <View style={styles.statsRow}>
        {/* Your Balance */}
        <Animated.View entering={FadeInRight.delay(100)} style={styles.statCardWrapper}>
            <LinearGradient
                colors={['#1C1C1E', '#2C2C2E']}
                style={styles.statCard}
            >
                <View style={styles.iconCircle}>
                    <Ionicons name="wallet" size={24} color="#4CD964" />
                </View>
                <View>
                    <ThemedText style={styles.statLabel}>Your Wallet</ThemedText>
                    <ThemedText style={styles.statValue}>{coins} Coins</ThemedText>
                </View>
            </LinearGradient>
        </Animated.View>

        {/* The Pool */}
        <Animated.View entering={FadeInRight.delay(200)} style={styles.statCardWrapper}>
            <LinearGradient
                colors={['#333', '#1A1A1A']}
                style={styles.statCard}
            >
                <View style={[styles.iconCircle, {backgroundColor: 'rgba(255, 215, 0, 0.2)'}]}>
                    <Ionicons name="gift" size={24} color="#FFD700" />
                </View>
                <View>
                    <ThemedText style={styles.statLabel}>Active Pool</ThemedText>
                    <ThemedText style={[styles.statValue, {color: '#FFD700'}]}>{poolSize} Coins</ThemedText>
                </View>
            </LinearGradient>
        </Animated.View>
      </View>

      {/* 2. GROUP LEADERBOARD */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Your Squad</ThemedText>
        <ThemedText style={styles.timerText}>Ends in {daysLeft} days</ThemedText>
      </ThemedView>

      <View style={styles.listContainer}>
        {INITIAL_GROUP.map((member, index) => (
            <Animated.View 
                key={member.id} 
                entering={FadeInDown.delay(300 + (index * 100))}
                style={styles.memberRow}
            >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={40} color={member.color} />
                </View>

                {/* Info */}
                <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                        <ThemedText style={styles.memberName}>
                            {member.name} {member.isMe && <ThemedText style={styles.youTag}>(You)</ThemedText>}
                        </ThemedText>
                        <ThemedText style={styles.fraction}>
                            {member.matches}/{member.goal}
                        </ThemedText>
                    </View>
                    
                    {renderProgressBar(member.matches, member.goal, member.color)}
                </View>

                {/* Status Icon */}
                <View style={styles.statusIcon}>
                    {member.matches >= member.goal ? (
                        <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
                    ) : (
                        <Ionicons name="ellipse-outline" size={24} color="#666" />
                    )}
                </View>
            </Animated.View>
        ))}
      </View>

      {/* 3. INFO BOX */}
      <Animated.View entering={FadeInDown.delay(800)} style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#888" />
        <ThemedText style={styles.infoText}>
            Winner takes all. If multiple members hit 100% consistency, the pool is split.
        </ThemedText>
      </Animated.View>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    bottom: -40,
    right: -20,
    position: 'absolute',
    opacity: 0.2,
    transform: [{ rotate: '-15deg' }]
  },
  titleContainer: {
    marginBottom: 0,
    paddingHorizontal: 10,
  },
  mainTitle: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#fff',
  },
  subtitle: {
    fontSize: 18,
    color: '#808080',
    marginTop: 5,
  },
  
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 10,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 217, 100, 0.2)', // transparent green default
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Leaderboard
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  timerText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  listContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  avatarContainer: {
    width: 50,
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    paddingHorizontal: 10,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  youTag: {
    color: '#888',
    fontSize: 14,
    fontWeight: '400',
  },
  fraction: {
    color: '#888',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusIcon: {
    width: 30,
    alignItems: 'center',
  },

  // Footer
  infoBox: {
    marginTop: 30,
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    alignItems: 'center',
  },
  infoText: {
    color: '#666',
    flex: 1,
    fontSize: 13,
  },
});