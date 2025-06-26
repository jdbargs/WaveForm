import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../theme';
import Win95Button from './Win95Button';

export default function Win95Popup({
  visible,
  title,
  children,
  onClose = () => {},
  actions = []
}) {
  const t = useTheme();

  // Default to a single OK button if no actions provided
  const buttons = actions.length > 0
    ? actions
    : [{ label: 'OK', onPress: onClose }];

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.overlay}>
        <View style={[
          styles.window,
          {
            backgroundColor: t.colors.windowBackground,
            borderTopColor: t.colors.buttonHighlight,
            borderLeftColor: t.colors.buttonHighlight,
            borderBottomColor: t.colors.buttonShadow,
            borderRightColor: t.colors.buttonShadow
          }
        ]}>

          <View style={[
            styles.header,
            {
              backgroundColor: t.colors.buttonFace,
              borderBottomColor: t.colors.buttonShadow
            }
          ]}>
            <Text style={[
              styles.headerText,
              { color: t.colors.text, fontFamily: t.font.family }
            ]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[
                styles.closeText,
                { color: t.colors.text, fontFamily: t.font.family }
              ]}>
                X
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[
            styles.content,
            { backgroundColor: t.colors.windowBackground }
          ]}>
            {children}
          </View>

          <View style={styles.footer}>
            {buttons.map((btn, i) => (
              <Win95Button
                key={i}
                title={btn.label}
                onPress={btn.onPress}
                style={styles.actionButton}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  window: {
    width: 300,
    borderWidth: 2
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: 2
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  closeButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeText: {
    fontSize: 12
  },
  content: {
    padding: 8
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 4
  },
  actionButton: {
    marginLeft: 8
  }
});
