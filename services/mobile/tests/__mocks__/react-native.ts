import React from 'react';

// Host components are plain strings: react-test-renderer renders them as host nodes
// (`node.type === 'Text'`), so tests can query them by type, props and text.
const View = 'View';
const Text = 'Text';
const ScrollView = 'ScrollView';
const TouchableOpacity = 'TouchableOpacity';
const ActivityIndicator = 'ActivityIndicator';
const RefreshControl = 'RefreshControl';
const StyleSheet = { create: (s: Record<string, unknown>) => s };
const Alert = { alert: jest.fn() };
const Linking = { openURL: jest.fn() };
const Platform = { OS: 'ios' };
const BackHandler = { exitApp: jest.fn() };

interface MockSection {
  data: readonly unknown[];
  [key: string]: unknown;
}

interface MockSectionListProps {
  sections?: readonly MockSection[];
  renderItem: (info: { item: unknown; index: number; section: MockSection }) => React.ReactNode;
  renderSectionHeader?: (info: { section: MockSection }) => React.ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  refreshControl?: React.ReactElement;
  [key: string]: unknown;
}

// Functional SectionList: unlike a string host, it actually calls renderSectionHeader and
// renderItem for every section and row, so list content is rendered and testable. Like RN's
// ScrollView, it renders the `refreshControl` element (so its props can be inspected and its
// onRefresh fired); the remaining props stay on the 'SectionList' host.
function SectionList({
  sections = [],
  renderItem,
  renderSectionHeader,
  keyExtractor,
  refreshControl,
  ...rest
}: MockSectionListProps) {
  const children = sections.flatMap((section, s) => [
    React.createElement(React.Fragment, { key: `header-${s}` }, renderSectionHeader?.({ section }) ?? null),
    ...section.data.map((item, index) =>
      React.createElement(
        React.Fragment,
        { key: keyExtractor ? keyExtractor(item, index) : `${s}-${index}` },
        renderItem({ item, index, section }),
      ),
    ),
  ]);
  return React.createElement(
    'SectionList',
    rest,
    refreshControl ? React.cloneElement(refreshControl, { key: 'refresh-control' }) : null,
    ...children,
  );
}

export {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  BackHandler,
};
