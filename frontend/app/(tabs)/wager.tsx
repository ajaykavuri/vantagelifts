import React, { useState } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Alert, Vibration } from 'react-native';
import Animated, { FadeInDown, FadeInRight, ZoomIn, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics'; 

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const { width } = Dimensions.get('window');

// --- MOCK DATA ---
const INITIAL_GROUP = [
  { id: '2', name: 'sreyya', matches: 0, goal: 5, avatar: 'p.circle.fill', color: '#FF2D55', isMe: false, status: 'Joined' },
  { id: '3', name: 'KCLuo', matches: 0, goal: 4, avatar: 'g.circle.fill', color: '#5856D6', isMe: false, status: 'Joined' },
  { id: '4', name: 'Anthony', matches: 0, goal: 3, avatar: 'm.circle.fill', color: '#FF9500', isMe: false, status: 'Pending' },
];

export default function WagerScreen() {
  const [coins, setCoins] = useState(10); // Start with more coins to test the feature
  const [poolSize, setPoolSize] = useState(5); 
  const [hasJoined, setHasJoined] = useState(false);
  
  // NEW: State to track how much user wants to bet
  const [wagerAmount, setWagerAmount] = useState(1);

  // --- ACTIONS ---

  const incrementWager = () => {
    if (wagerAmount < coins) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setWagerAmount(prev => prev + 1);
    } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const decrementWager = () => {
    if (wagerAmount > 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setWagerAmount(prev => prev - 1);
    }
  };

  const handleWager = () => {
    if (coins < wagerAmount) {
        Alert.alert("Insufficient Funds", "You don't have enough coins for this wager.");
        return;
    }

    // Success Haptics
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Vibration.vibrate(50);

    // Logic Update
    setCoins(prev => prev - wagerAmount);
    setPoolSize(prev => prev + wagerAmount);
    setHasJoined(true);
  };

  // --- RENDER HELPERS ---

  const renderProgressBar = (current: number, goal: number, color: string) => {
    const progress = Math.min(current / goal, 1);
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
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
          <ThemedText style={styles.subtitle}>
             {hasJoined ? "You're in. Good luck." : "High risk, high reward."}
          </ThemedText>
        </Animated.View>
      </ThemedView>

      {/* 1. STATUS CARDS */}
      <View style={styles.statsRow}>
        <Animated.View entering={FadeInRight.delay(100)} style={styles.statCardWrapper}>
            <LinearGradient colors={['#1C1C1E', '#2C2C2E']} style={styles.statCard}>
                <View style={styles.iconCircle}>
                    <Ionicons name="wallet" size={24} color="#4CD964" />
                </View>
                <View>
                    <ThemedText style={styles.statLabel}>Your Wallet</ThemedText>
                    <Animated.Text key={coins} entering={ZoomIn} style={styles.statValue}>
                        {coins} Coins
                    </Animated.Text>
                </View>
            </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInRight.delay(200)} style={styles.statCardWrapper}>
            <LinearGradient colors={['#333', '#1A1A1A']} style={styles.statCard}>
                <View style={[styles.iconCircle, {backgroundColor: 'rgba(255, 215, 0, 0.2)'}]}>
                    <Ionicons name="gift" size={24} color="#FFD700" />
                </View>
                <View>
                    <ThemedText style={styles.statLabel}>Total Pool</ThemedText>
                    <Animated.Text key={poolSize} entering={ZoomIn} style={[styles.statValue, {color: '#FFD700'}]}>
                        {poolSize} Coins
                    </Animated.Text>
                </View>
            </LinearGradient>
        </Animated.View>
      </View>

      {/* 2. INTERACTIVE WAGER ACTION */}
      <View style={styles.actionContainer}>
        {!hasJoined ? (
            <Animated.View exiting={FadeInDown} layout={Layout.springify()}>
                
                {/* NEW: WAGER SELECTOR UI */}
                <View style={styles.selectorContainer}>
                    <ThemedText style={styles.selectorLabel}>SET YOUR STAKE</ThemedText>
                    <View style={styles.stepperRow}>
                        <TouchableOpacity onPress={decrementWager} style={styles.stepperBtn}>
                            <Ionicons name="remove" size={24} color="white" />
                        </TouchableOpacity>
                        
                        <View style={styles.amountDisplay}>
                            <ThemedText style={styles.amountText}>{wagerAmount}</ThemedText>
                            <ThemedText style={styles.coinLabel}>COINS</ThemedText>
                        </View>

                        <TouchableOpacity onPress={incrementWager} style={styles.stepperBtn}>
                            <Ionicons name="add" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* CONFIRM BUTTON */}
                <TouchableOpacity onPress={handleWager} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#FFD700', '#FFA500']}
                        start={{x:0, y:0}} end={{x:1, y:1}}
                        style={styles.wagerButton}
                    >
                        <Ionicons name="cash-outline" size={28} color="#000" />
                        <View>
                            <ThemedText style={styles.wagerButtonText}>Place Wager</ThemedText>
                            <ThemedText style={styles.wagerSubText}>
                                Pot will grow by {wagerAmount}
                            </ThemedText>
                        </View>
                        <Ionicons name="arrow-forward-circle" size={32} color="#000" style={{marginLeft:'auto'}} />
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        ) : (
            <Animated.View entering={FadeInDown} layout={Layout.springify()} style={styles.joinedBanner}>
                <Ionicons name="checkmark-circle" size={32} color="#4CD964" />
                <View>
                    <ThemedText style={styles.joinedText}>Wager Confirmed!</ThemedText>
                    <ThemedText style={{color:'#888'}}>You staked {wagerAmount} coins.</ThemedText>
                </View>
            </Animated.View>
        )}
      </View>

      {/* 3. GROUP LEADERBOARD */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Live Standings</ThemedText>
      </ThemedView>

      <View style={styles.listContainer}>
        {hasJoined && (
            <Animated.View entering={FadeInDown} style={styles.memberRow}>
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={40} color="#007AFF" />
                </View>
                <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                        <ThemedText style={styles.memberName}>You <ThemedText style={styles.youTag}>(Target: 4)</ThemedText></ThemedText>
                        <ThemedText style={styles.fraction}>0/4</ThemedText>
                    </View>
                    {renderProgressBar(0, 4, '#007AFF')}
                </View>
            </Animated.View>
        )}

        {INITIAL_GROUP.map((member, index) => (
            <Animated.View 
                key={member.id} 
                entering={FadeInDown.delay(300 + (index * 100))}
                style={[styles.memberRow, {opacity: member.status === 'Pending' ? 0.5 : 1}]}
            >
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={40} color={member.color} />
                </View>
                <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                        <ThemedText style={styles.memberName}>{member.name}</ThemedText>
                        <ThemedText style={styles.fraction}>
                            {member.status === 'Pending' ? 'Thinking...' : `0/${member.goal}`}
                        </ThemedText>
                    </View>
                    {member.status === 'Joined' 
                        ? renderProgressBar(0, member.goal, member.color)
                        : <View style={{height:6, backgroundColor:'#222', borderRadius:3}} /> 
                    }
                </View>
            </Animated.View>
        ))}
      </View>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: { bottom: -40, right: -20, position: 'absolute', opacity: 0.2, transform: [{ rotate: '-15deg' }] },
  titleContainer: { marginBottom: 20, paddingHorizontal: 10 },
  mainTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -1, color: '#fff' },
  subtitle: { fontSize: 18, color: '#808080', marginTop: 5 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  statCardWrapper: { flex: 1 },
  statCard: { padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(76, 217, 100, 0.2)', justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },

  actionContainer: { marginBottom: 30 },
  
  // NEW STYLES FOR STEPPER
  selectorContainer: { marginBottom: 15, padding: 15, backgroundColor:'#1C1C1E', borderRadius: 16, borderWidth:1, borderColor:'#333' },
  selectorLabel: { color:'#888', fontSize:12, fontWeight:'bold', marginBottom:10, textAlign:'center', letterSpacing:1 },
  stepperRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  stepperBtn: { width:50, height:50, borderRadius:25, backgroundColor:'#333', justifyContent:'center', alignItems:'center' },
  amountDisplay: { alignItems:'center' },
  amountText: { color:'white', fontSize:25, fontWeight:'800' },
  coinLabel: { color:'#FFD700', fontSize:10, fontWeight:'bold' },

  wagerButton: {
    flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, gap: 15,
    shadowColor: '#FFD700', shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
  },
  wagerButtonText: { fontSize: 20, fontWeight: '800', color: 'black' },
  wagerSubText: { fontSize: 14, color: '#333', fontWeight: '600' },
  
  joinedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15,
    backgroundColor: 'rgba(76, 217, 100, 0.1)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#4CD964'
  },
  joinedText: { color: '#4CD964', fontWeight: 'bold', fontSize: 20 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  listContainer: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 10, borderWidth: 1, borderColor: '#333' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  avatarContainer: { width: 50, alignItems: 'center' },
  memberInfo: { flex: 1, paddingHorizontal: 10 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  youTag: { color: '#007AFF', fontSize: 14 },
  fraction: { color: '#888', fontSize: 14, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});