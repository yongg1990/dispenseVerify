<template>
  <AppShell title="我的" active="profile" nursing>
    <view class="profile-header"><view class="profile-avatar">{{ operator.name.slice(0, 1) }}</view><view><text class="page-title">{{ operator.name }}</text><text class="row-subtitle">{{ operator.department }} · {{ businessLabel }}业务</text></view><text class="shift-badge">当班中</text></view>
    <view class="section-heading"><text>工作信息</text></view>
    <view class="settings-list"><view class="setting-row"><text>所属医院</text><text>{{ hospital.name }}</text></view><view class="setting-row"><text>医院编码</text><text>{{ hospital.id || '--' }}</text></view><view class="setting-row"><text>当前操作人</text><text>{{ operator.name }} / {{ operator.id }}</text></view><view class="setting-row"><text>运行环境</text><text class="amber-text">{{ useStaticData ? '静态数据' : '接口模式' }}</text></view><view class="setting-row"><text>HIS / 短信服务</text><text class="muted">{{ useStaticData ? '未连接' : '由服务端处理，未提供查询接口' }}</text></view></view>
    <view class="version-text">中药房工作台 v0.1.0</view>
  </AppShell>
</template>
<script setup>
import { useStaticData } from '../../services/data-source'
import AppShell from '../../components/AppShell.vue'
import { operator, hospital, businessLabel } from '../../domain/pharmacy'
</script>

<style scoped>
.settings-list { border-top: 0; background: #edf2f7; }
.setting-row { padding: 16px 12px; border-left: 3px solid #a0b3c8; border-bottom-color: #dfe7ef; }
.setting-row > :first-child { color: #75899e; }
.setting-row > :last-child { color: #405d79; }
.setting-row:nth-child(4), .setting-row:nth-child(5) { border-left-color: #c39a57; background: #fcf5e9; }
.setting-row:nth-child(4) > :last-child, .setting-row:nth-child(5) > :last-child { color: #946e30; }
</style>
