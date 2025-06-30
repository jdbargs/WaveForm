import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../theme';
import Win95Button from './Win95Button';

// Helper to recursively apply Win95 text style to all text in the popup
function styleChildren(children, textStyle) {
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      return <Text style={textStyle}>{child}</Text>;
    }
    if (React.isValidElement(child)) {
      if (child.type === Text) {
        return React.cloneElement(child, {
          style: [textStyle, child.props.style]
        }, styleChildren(child.props.children, textStyle));
      }
      return React.cloneElement(child, child.props, styleChildren(child.props.children, textStyle));
    }
    return child;
  });
}

export default function Win95Popup({
  visible,
  title,
  children,
  onClose = () => {},
  actions = []
}) {
  const t = useTheme();

  // Default to a single OK button if no actions provided
  const buttons = actions;

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
          {/* Header FIRST */}
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
              <Text style={{ fontFamily: t.font.family, fontSize: t.font.sizes.body, color: t.colors.text }}>
                X
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={[
            styles.content,
            { backgroundColor: '#C0C0C0' }
          ]}>
            {styleChildren(children, {
              color: t.colors.text,
              fontFamily: t.font.family,
              fontSize: t.font.sizes.body
            })}
          </View>       
          
          {/* Footer */}
          {buttons.length > 0 && (
            <View style={[
              styles.footer,
              { backgroundColor: t.colors?.windowBackground || '#C0C0C0' }
            ]}>
              {buttons.map((btn, i) => (
                <Win95Button
                  key={i}
                  title={btn.label}
                  onPress={btn.onPress}
                  style={styles.actionButton}
                />
              ))}
            </View>
          )}
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
    borderWidth: 2,
    backgroundColor: '#C0C0C0',
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
    padding: 4,
    backgroundColor: '#C0C0C0'
  },
  actionButton: {
    marginLeft: 8
  }
});
