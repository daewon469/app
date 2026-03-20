import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { regions } from "../regions";

type RegionPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (province: string, city: string) => void;
};

export default function RegionPickerModal({
  visible,
  onClose,
  onSelect,
}: RegionPickerModalProps) {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  const handleProvinceSelect = (province: string) => {
    setSelectedProvince(province);
  };

  const handleCitySelect = (city: string) => {
    if (selectedProvince) {
      onSelect(selectedProvince, city);
      onClose();
      setSelectedProvince(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={{
          backgroundColor: "#fff",
          borderRadius: 10,
          maxHeight: "70%",
          padding: 10,
        }}>

          <View style={styles.header}>
            <Text style={styles.headerText}>
              {selectedProvince ? "시 / 군 선택" : "시 / 도 선택"}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>

          {!selectedProvince ? (
            <FlatList
              data={Object.keys(regions)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable style={styles.item} onPress={() => handleProvinceSelect(item)}>
                  <Text style={styles.itemText}>{item}</Text>
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              data={regions[selectedProvince] ?? []}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable style={styles.item} onPress={() => handleCitySelect(item)}>
                  <Text style={styles.itemText}>{item}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeText: { 
    color: "red",
    fontWeight: "bold",
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  itemText: {
    fontSize: 16,
  },
});
