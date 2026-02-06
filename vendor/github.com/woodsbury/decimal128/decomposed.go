package decimal128

import (
	"math"
	"strconv"
)

const expln = -57

var (
	dinf = decomposed192{
		sig: uint192{math.MaxUint64, math.MaxUint64, math.MaxUint64},
		exp: math.MaxInt16,
	}

	ln10 = decomposed192{
		sig: uint192{0x0193_5df2_0be5_35a1, 0x05cd_f4ae_1bee_93d0, 0x5de8_1c2d_b4b8_b6e0},
		exp: -57,
	}

	ln2 = decomposed192{
		sig: uint192{0x858a_b5e3_0047_4e69, 0x37c6_e47a_55a3_5374, 0x1c44_cb52_b6b7_4c42},
		exp: -57,
	}

	invLn10 = decomposed192{
		sig: uint192{0x225c_04d6_a014_36d9, 0xff32_111e_97d1_0db8, 0xb11e_75a6_72b6_07b7},
		exp: -58,
	}

	invLn2 = decomposed192{
		sig: uint192{0xf291_3320_09f2_3937, 0x9975_90b2_7010_b870, 0x3ad6_7064_88d7_799b},
		exp: -57,
	}

	ln = [...]uint192{
		{0xce06_052e_ed85_0b11, 0xf432_4af7_5d64_cfcb, 0x03e3_15af_624a_52e7}, // ln(1.1)
		{0xb352_8e25_962a_8d07, 0xa21f_990f_44a0_1c4d, 0x076f_869f_7595_b691}, // ln(1.2)
		{0x1a25_cea3_d4a1_52e2, 0xe179_b27c_1d59_58e7, 0x0ab3_35f2_7f80_2c14}, // ln(1.3)
		{0xc29b_26c7_4da3_cc33, 0x447d_92a8_ae23_ba16, 0x0db8_ef1e_b627_bfbd}, // ln(1.4)
		{0x2445_ca6e_a139_d76e, 0x0098_e04e_5fa4_b5c0, 0x1089_40d5_0628_88ab}, // ln(1.5)
		{0x1497_7999_f538_0401, 0xd94d_9d3b_3a9e_ba02, 0x132b_111d_2624_7a28}, // ln(1.6)
		{0xbe13_49be_566b_31c0, 0x53f1_7e04_1b66_c1da, 0x15a4_0476_af99_0d2e}, // ln(1.7)
		{0xd798_5894_3764_6475, 0xa2b8_795d_a444_d20d, 0x17f8_c774_7bbe_3f3c}, // ln(1.8)
		{0x3ebb_a665_59ef_25c9, 0x3825_0832_751f_5f0a, 0x1a2d_446a_7ec9_5e1c}, // ln(1.9)
		{0x858a_b5e3_0047_4e69, 0x37c6_e47a_55a3_5374, 0x1c44_cb52_b6b7_4c42}, // ln(2.0)
		{0xe6e0_f135_eedd_a3a1, 0x4516_72f7_0dc8_6fd6, 0x1e42_2ff3_bc50_4868}, // ln(2.1)
		{0x5390_bb11_edcc_597a, 0x2bf9_2f71_b308_2340, 0x2027_e102_1901_9f2a}, // ln(2.2)
		{0xaef4_f891_bf7e_1f8d, 0x4361_9f46_37f4_3cb8, 0x21f7_fa1c_4962_edb7}, // ln(2.3)
		{0x38dd_4408_9671_db6f, 0xd9e6_7d89_9a43_6fc2, 0x23b4_51f2_2c4d_02d3}, // ln(2.4)
		{0xf67d_f22c_0b56_98d0, 0x9640_2bb9_70a7_ece6, 0x255e_8588_474a_1e5b}, // ln(2.5)
		{0x9fb0_8486_d4e8_a14a, 0x1940_96f6_72fc_ac5b, 0x26f8_0145_3637_7857}, // ln(2.6)
		{0xfbde_2302_d89e_3be3, 0xa351_59ac_03e9_87cd, 0x2882_0849_81e6_c7e7}, // ln(2.7)
		{0x4825_dcaa_4deb_1a9b, 0x7c44_7723_03c7_0d8b, 0x29fd_ba71_6cdf_0bff}, // ln(2.8)
		{0xb3e9_e533_f3b6_1ca8, 0xffd0_5b4b_98de_4ef8, 0x2b6c_1948_c734_4a0d}, // ln(2.9)
		{0xa9d0_8051_a181_25d7, 0x385f_c4c8_b548_0934, 0x2cce_0c27_bcdf_d4ed}, // ln(3.0)
		{0xc27d_4089_0337_700b, 0x7146_7807_969e_299d, 0x2e24_63a2_f2ca_b5c1}, // ln(3.1)
		{0x9a22_2f7c_f57f_526a, 0x1114_81b5_9042_0d76, 0x2f6f_dc6f_dcdb_c66b}, // ln(3.2)
		{0x77d6_8580_8f06_30e8, 0x2c92_0fc0_12ac_d900, 0x30b1_21d7_1f2a_27d5}, // ln(3.3)
		{0x439d_ffa1_56b2_8029, 0x8bb8_627e_710a_154f, 0x31e8_cfc9_6650_5970}, // ln(3.4)
		{0xb919_18f3_58fa_6503, 0xdabd_be62_1ecb_a6fd, 0x3317_74a6_fd71_de18}, // ln(3.5)
		{0x5d23_0e77_37ab_b2dd, 0xda7f_5dd7_f9e8_2582, 0x343d_92c7_3275_8b7e}, // ln(3.6)
		{0x69d0_a4c1_549f_d69c, 0xdd0f_8e01_8b1e_e9c9, 0x355b_a1ca_1731_b507}, // ln(3.7)
		{0xc446_5c48_5a36_7431, 0x6feb_ecac_cac2_b27e, 0x3672_0fbd_3580_aa5e}, // ln(3.8)
		{0xc3f6_4ef5_7622_78b8, 0x19d9_7744_d2a1_621b, 0x3781_421a_3c60_0102}, // ln(3.9)
		{0x0b15_6bc6_008e_9cd1, 0x6f8d_c8f4_ab46_a6e9, 0x3889_96a5_6d6e_9884}, // ln(4.0)
		{0xe28e_8b7b_5605_80b2, 0x397b_4431_992e_98ee, 0x398b_6430_9250_5cf1}, // ln(4.1)
		{0x6c6b_a718_ef24_f209, 0x7cdd_5771_636b_c34b, 0x3a86_fb46_7307_94aa}, // ln(4.2)
		{0xd8b1_0e6e_1f3a_6af6, 0xa701_96a9_626a_a2b9, 0x3b7c_a6c2_1ebe_1cab}, // ln(4.3)
		{0xd91b_70f4_ee13_a7e3, 0x63c0_13ec_08ab_76b4, 0x3c6c_ac54_cfb8_eb6c}, // ln(4.4)
		{0xce16_4ac0_42ba_fd45, 0x38f8_a517_14ec_bef4, 0x3d57_4cfc_c308_5d98}, // ln(4.5)
		{0x347f_ae74_bfc5_6df6, 0x7b28_83c0_8d97_902d, 0x3e3c_c56f_001a_39f9}, // ln(4.6)
		{0x43e8_ca2c_117f_6c0f, 0x398b_8628_b08d_cde8, 0x3f1d_4e75_bfcd_2079}, // ln(4.7)
		{0xbe67_f9eb_96b9_29d8, 0x11ad_6203_efe6_c336, 0x3ff9_1d44_e304_4f16}, // ln(4.8)
		{0x7bb4_3fba_a69e_3135, 0x1f3b_510a_ccef_6114, 0x40d0_63c5_b399_9dd6}, // ln(4.9)
		{0x7c08_a80f_0b9d_e739, 0xce07_1033_c64b_405b, 0x41a3_50da_fe01_6a9d}, // ln(5.0)
		{0x67e3_ca0f_f7ec_5797, 0x8c51_42cc_d0ae_cb0f, 0x4272_109e_6c78_e21b}, // ln(5.1)
		{0x253b_3a69_d52f_efb3, 0x5107_7b70_c89f_ffd0, 0x433c_cc97_ecee_c499}, // ln(5.2)
		{0xab7a_5b8e_d6d1_7c47, 0x1b42_3605_7910_936c, 0x4403_abef_d001_c5a5}, // ln(5.3)
		{0x8168_d8e5_d8e5_8a4b, 0xdb18_3e26_598c_db42, 0x44c6_d39c_389e_1429}, // ln(5.4)
		{0x4a0e_ad3d_f922_f24a, 0xc239_5b2b_23b0_1027, 0x4586_668a_604b_bd85}, // ln(5.5)
		{0xcdb0_928d_4e32_6904, 0xb40b_5b9d_596a_60ff, 0x4642_85c4_2396_5841}, // ln(5.6)
		{0xe88c_26b6_fb70_4b9f, 0x7084_ccfb_2a67_683e, 0x46fb_5092_3ba9_3309}, // ln(5.7)
		{0x3974_9b16_f3fd_6b11, 0x3797_3fc5_ee81_a26d, 0x47b0_e49b_7deb_9650}, // ln(5.8)
		{0xd2c2_8970_025a_1047, 0xaf22_6b1b_a088_567d, 0x4863_5e01_6fc8_129d}, // ln(5.9)
		{0x2f5b_3634_a1c8_743f, 0x7026_a943_0aeb_5ca9, 0x4912_d77a_7397_212f}, // ln(6.0)
		{0x9b3c_dbdf_230c_2578, 0x9616_fdb5_2530_20ba, 0x49bf_6a69_cbaa_177b}, // ln(6.1)
		{0x4807_f66c_037e_be74, 0xa90d_5c81_ec41_7d12, 0x4a69_2ef5_a982_0203}, // ln(6.2)
		{0x90b1_7187_905e_c977, 0x7d76_37bf_c310_790b, 0x4b10_3c1b_7930_1d55}, // ln(6.3)
		{0x1fac_e55f_f5c6_a0d3, 0x48db_662f_e5e5_60eb, 0x4bb4_a7c2_9393_12ad}, // ln(6.4)
		{0x962e_76b2_e03f_3a1a, 0xaf80_c2af_e3a4_9942, 0x4c56_86cd_7d81_96b2}, // ln(6.5)
		{0xfd61_3b63_8f4d_7f51, 0x6458_f43a_6850_2c74, 0x4cf5_ed29_d5e1_7417}, // ln(6.6)
		{0x4d02_0691_ecd6_5f10, 0xdef9_cc6c_3618_5eca, 0x4d92_eddf_1115_ca85}, // ln(6.7)
		{0xc928_b584_56f9_ce91, 0xc37f_46f8_c6ad_68c3, 0x4e2d_9b1c_1d07_a5b2}, // ln(6.8)
		{0x58c5_78e3_60ff_4564, 0x7bc1_640e_ed3c_45ed, 0x4ec6_0644_0642_c2a4}, // ln(6.9)
		{0x3ea3_ced6_5941_b36b, 0x1284_a2dc_746e_fa72, 0x4f5c_3ff9_b429_2a5b}, // ln(7.0)
		{0xf07c_9f19_1e68_0638, 0x3b1b_d0da_b4d3_d782, 0x4ff0_582a_d010_bcaf}, // ln(7.1)
		{0xe2ad_c45a_37f3_0146, 0x1246_4252_4f8b_78f6, 0x5082_5e19_e92c_d7c1}, // ln(7.2)
		{0x7083_fc6a_d208_73b2, 0x5445_67d2_67ad_ca0f, 0x5112_6067_e56c_3166}, // ln(7.3)
		{0xef5b_5aa4_54e7_2504, 0x14d6_727b_e0c2_3d3d, 0x51a0_6d1c_cde9_014a}, // ln(7.4)
		{0xa04e_727d_acd7_bea7, 0xce9f_f082_25ef_f61b, 0x522c_91b0_0429_f348}, // ln(7.5)
		{0x49d1_122b_5a7d_c29a, 0xa7b2_d127_2066_05f3, 0x52b6_db0f_ec37_f6a0}, // ln(7.6)
		{0x0ca9_d405_46c6_be7d, 0x06b6_edd3_d1d3_ca3e, 0x533f_55a9_1673_7d43}, // ln(7.7)
		{0x4981_04d8_7669_c721, 0x51a0_5bbf_2844_b590, 0x53c6_0d6c_f317_4d44}, // ln(7.8)
		{0x5e09_218f_8e58_6ba3, 0xcf83_91e4_317a_22d1, 0x544b_0dd8_1874_4ff3}, // ln(7.9)
		{0x90a0_21a9_00d5_eb3a, 0xa754_ad6f_00e9_fa5d, 0x54ce_61f8_2425_e4c6}, // ln(8.0)
		{0xa5ae_a354_7a1f_61b9, 0xdbb1_1e74_b931_9102, 0x5550_1471_3ec6_9cd4}, // ln(8.1)
		{0x6819_415e_564c_cf1b, 0x7142_28ab_eed1_ec63, 0x55d0_2f83_4907_a933}, // ln(8.2)
		{0x8db3_4b47_6c54_a96b, 0x62b0_75c1_2fb5_6287, 0x564e_bd0e_b877_bb77}, // ln(8.3)
		{0xf1f6_5cfb_ef6c_4072, 0xb4a4_3beb_b90f_16bf, 0x56cb_c699_29be_e0ec}, // ln(8.4)
		{0x3a1b_f1cd_6209_18f9, 0x21f8_8e37_e1b2_0236, 0x5747_5551_ad9a_77cc}, // ln(8.5)
		{0x5e3b_c451_1f81_b95f, 0xdec8_7b23_b80d_f62e, 0x57c1_7214_d575_68ed}, // ln(8.6)
		{0x5dba_6585_9537_427f, 0x3830_2014_4e26_582d, 0x583a_2570_8414_1efb}, // ln(8.7)
		{0x5ea6_26d7_ee5a_f64b, 0x9b86_f866_5e4e_ca29, 0x58b1_77a7_8670_37ae}, // ln(8.8)
		{0x0068_a073_0412_de69, 0xf885_50ee_b461_f78d, 0x5927_70b4_f88c_b48f}, // ln(8.9)
		{0x53a1_00a3_4302_4bad, 0x70bf_8991_6a90_1269, 0x599c_184f_79bf_a9da}, // ln(9.0)
		{0x58c9_9d7a_2de3_064d, 0xf3fe_5558_91c8_5359, 0x5a0f_75ec_33a9_566f}, // ln(9.1)
		{0xba0a_6457_c00c_bc5f, 0xb2ef_683a_e33a_e3a1, 0x5a81_90c1_b6d1_863b}, // ln(9.2)
		{0x6c4d_c0da_a4b8_95e2, 0xa9a6_3cd0_4be6_32d2, 0x5af2_6fca_afaa_8aae}, // ln(9.3)
		{0xc973_800f_11c6_ba78, 0x7152_6aa3_0631_215c, 0x5b62_19c8_7684_6cbb}, // ln(9.4)
		{0xbac4_4e74_658d_0d01, 0x062c_1866_3b6a_9f65, 0x5bd0_9545_7cca_c8ba}, // ln(9.5)
		{0x43f2_afce_9700_7841, 0x4974_467e_458a_16ab, 0x5c3d_e897_99bb_9b58}, // ln(9.6)
		{0x933f_0a3f_f913_ea27, 0xaada_8272_21d0_0c36, 0x5caa_19e2_389c_c6c5}, // ln(9.7)
		{0x013e_f59d_a6e5_7f9e, 0x5702_3585_2292_b489, 0x5d15_2f18_6a50_ea18}, // ln(9.8)
		{0x21a7_05d2_3087_56bf, 0x64f1_d488_c7f4_e235, 0x5d7f_2dfe_dc09_fcc2}, // ln(9.9)
	}
)

type decomposed192 struct {
	sig uint192
	exp int16
}

func (d decomposed192) String() string {
	return d.sig.String() + "e" + strconv.FormatInt(int64(d.exp), 10)
}

func (d decomposed192) add(o decomposed192, trunc int8) (decomposed192, int8) {
	exp := d.exp - o.exp

	if exp < 0 {
		for exp <= -19 && o.sig[2] == 0 {
			o.sig = o.sig.mul64(10_000_000_000_000_000_000)
			o.exp -= 19
			exp += 19
		}

		for exp <= -4 && o.sig[2] <= 0x0002_7fff_ffff_ffff {
			o.sig = o.sig.mul64(10_000)
			o.exp -= 4
			exp += 4
		}

		for exp < 0 && o.sig[2] <= 0x18ff_ffff_ffff_ffff {
			o.sig = o.sig.mul64(10)
			o.exp--
			exp++
		}

		if exp < -57 {
			if d.sig[0]|d.sig[1]|d.sig[2] != 0 {
				d.sig = uint192{}
				trunc = 1
			}

			d.exp = o.exp
			exp = 0
		}

		for exp <= -4 {
			var rem uint64
			d.sig, rem = d.sig.div10000()
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				d.exp = o.exp
				exp = 0
			} else {
				d.exp += 4
				exp += 4
			}
		}

		for exp < 0 {
			var rem uint64
			d.sig, rem = d.sig.div10()
			d.exp++
			exp++
			if rem != 0 {
				trunc = 1
			}
		}
	} else if exp > 0 {
		for exp >= 19 && d.sig[2] == 0 {
			d.sig = d.sig.mul64(10_000_000_000_000_000_000)
			d.exp -= 19
			exp -= 19
		}

		for exp >= 4 && d.sig[2] <= 0x0002_7fff_ffff_ffff {
			d.sig = d.sig.mul64(10_000)
			d.exp -= 4
			exp -= 4
		}

		for exp > 0 && d.sig[2] <= 0x18ff_ffff_ffff_ffff {
			d.sig = d.sig.mul64(10)
			d.exp--
			exp--
		}

		if exp > 57 {
			if o.sig[0]|o.sig[1]|o.sig[2] != 0 {
				o.sig = uint192{}
				trunc = -1
			}

			exp = 0
		}

		for exp >= 4 {
			var rem uint64
			o.sig, rem = o.sig.div10000()
			if rem != 0 {
				trunc = -1
			}

			if o.sig[0]|o.sig[1]|o.sig[2] == 0 {
				exp = 0
			} else {
				exp -= 4
			}
		}

		for exp > 0 {
			var rem uint64
			o.sig, rem = o.sig.div10()
			exp--
			if rem != 0 {
				trunc = 1
			}
		}
	}

	sig256 := d.sig.add(o.sig)
	exp = d.exp

	for sig256[3] >= 0x0000_0000_0000_ffff {
		var rem uint64
		sig256, rem = sig256.div10000()
		exp += 4

		if rem != 0 {
			trunc = 1
		}
	}

	for sig256[3] > 0 {
		var rem uint64
		sig256, rem = sig256.div10()
		exp++
		if rem != 0 {
			trunc = 1
		}
	}

	return decomposed192{
		sig: uint192{sig256[0], sig256[1], sig256[2]},
		exp: exp,
	}, trunc
}

func (d decomposed192) add1(trunc int8) (decomposed192, int8) {
	if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
		return decomposed192{
			sig: uint192{1, 0, 0},
			exp: 0,
		}, trunc
	}

	if d.exp < -116 {
		return decomposed192{
			sig: uint192{1, 0, 0},
			exp: 0,
		}, 1
	}

	if d.exp > 58 {
		return d, 1
	}

	var sig256 uint256

	if d.exp <= 0 {
		for d.exp < -62 {
			var rem uint64
			d.sig, rem = d.sig.div10000()
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				return decomposed192{
					sig: uint192{1, 0, 0},
					exp: 0,
				}, trunc
			}

			d.exp += 4
		}

		for d.exp < -57 {
			var rem uint64
			d.sig, rem = d.sig.div10()
			d.exp++
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				return decomposed192{
					sig: uint192{1, 0, 0},
					exp: 0,
				}, trunc
			}
		}

		sig256 = d.sig.add(uint192PowersOf10[-d.exp])
	} else {
		for d.exp > 4 && d.sig[2] <= 0x0002_7fff_ffff_ffff {
			d.sig = d.sig.mul64(10_000)
			d.exp -= 4
		}

		for d.exp > 0 && d.sig[2] <= 0x18ff_ffff_ffff_ffff {
			d.sig = d.sig.mul64(10)
			d.exp--
		}

		if d.exp != 0 {
			return d, 1
		}

		sig256 = d.sig.add(uint192{1, 0, 0})
	}

	if sig256[3] != 0 {
		var rem uint64
		sig256, rem = sig256.div10()
		d.exp++

		if rem != 0 {
			trunc = 1
		}
	}

	return decomposed192{
		sig: uint192{sig256[0], sig256[1], sig256[2]},
		exp: d.exp,
	}, trunc
}

func (d decomposed192) add1neg(trunc int8) (bool, decomposed192, int8) {
	if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
		return false, decomposed192{
			sig: uint192{1, 0, 0},
			exp: 0,
		}, trunc
	}

	if d.exp < -116 {
		return false, decomposed192{
			sig: uint192{1, 0, 0},
			exp: 0,
		}, trunc
	}

	if d.exp > 58 {
		return true, d, 1
	}

	var sig uint192
	var brw uint

	if d.exp <= 0 {
		for d.exp < -62 {
			var rem uint64
			d.sig, rem = d.sig.div10000()
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				return false, decomposed192{
					sig: uint192{1, 0, 0},
					exp: 0,
				}, trunc
			}

			d.exp += 4
		}

		for d.exp < -57 {
			var rem uint64
			d.sig, rem = d.sig.div10()
			d.exp++
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				return false, decomposed192{
					sig: uint192{1, 0, 0},
					exp: 0,
				}, trunc
			}
		}

		sig, brw = uint192PowersOf10[-d.exp].sub(d.sig)
	} else {
		for d.exp > 4 && d.sig[2] <= 0x0002_7fff_ffff_ffff {
			d.sig = d.sig.mul64(10_000)
			d.exp -= 4
		}

		for d.exp > 0 && d.sig[2] <= 0x18ff_ffff_ffff_ffff {
			d.sig = d.sig.mul64(10)
			d.exp--
		}

		if d.exp != 0 {
			return true, d, 1
		}

		sig, brw = uint192{1, 0, 0}.sub(d.sig)
	}

	neg := false

	if brw != 0 {
		sig = sig.twos()
		neg = true
		trunc *= -1
	}

	return neg, decomposed192{
		sig: sig,
		exp: d.exp,
	}, trunc
}

func (d decomposed192) epow(l10 int16, trunc int8) (decomposed192, int8) {
	exp := d.exp + l10 + 1
	if exp < 0 {
		exp = 0
	} else {
		d.exp = -l10 - 1
	}

	for d.sig[2] <= 0x0002_7fff_ffff_ffff {
		d.sig = d.sig.mul64(10_000)
		d.exp -= 4
	}

	for d.sig[2] <= 0x18ff_ffff_ffff_ffff {
		d.sig = d.sig.mul64(10)
		d.exp--
	}

	res, trunc := d.quo(decomposed192{
		sig: uint192{40, 0, 0},
		exp: 0,
	}, trunc)

	for i := uint64(39); i > 1; i-- {
		tmp, _ := d.quo(decomposed192{
			sig: uint192{i, 0, 0},
			exp: 0,
		}, int8(0))

		res, trunc = res.mul(tmp, trunc)
		res, trunc = res.add1(trunc)
	}

	res, trunc = res.mul(d, trunc)
	res, trunc = res.add1(trunc)

	return res.powexp10(exp, trunc)
}

func (d decomposed192) epowm1(neg bool, l10 int16, trunc int8) (bool, decomposed192, int8) {
	exp := d.exp + l10 + 1
	if exp < 0 {
		exp = 0
	} else {
		d.exp = -l10 - 1
	}

	for d.sig[2] <= 0x0002_7fff_ffff_ffff {
		d.sig = d.sig.mul64(10_000)
		d.exp -= 4
	}

	for d.sig[2] <= 0x18ff_ffff_ffff_ffff {
		d.sig = d.sig.mul64(10)
		d.exp--
	}

	res, trunc := d.quo(decomposed192{
		sig: uint192{40, 0, 0},
		exp: 0,
	}, trunc)

	for i := uint64(39); i > 1; i-- {
		tmp, _ := d.quo(decomposed192{
			sig: uint192{i, 0, 0},
			exp: 0,
		}, int8(0))

		res, trunc = res.mul(tmp, trunc)
		res, trunc = res.add1(trunc)
	}

	res, trunc = res.mul(d, trunc)

	if res.exp > maxUnbiasedExponent+58 {
		if neg {
			return true, decomposed192{
				sig: uint192{1, 0, 0},
				exp: 0,
			}, 0
		}

		return false, dinf, 0
	}

	if exp == 0 {
		if neg {
			res, trunc = res.add1(trunc)
			res, trunc = res.rcp(trunc)
			return res.sub1(trunc)
		}

		return false, res, trunc
	}

	res, trunc = res.add1(trunc)
	res, trunc = res.powexp10(exp, trunc)

	if neg {
		res, trunc = res.rcp(trunc)
	}

	return res.sub1(trunc)
}

func (d decomposed192) log() (bool, decomposed192, int8) {
	l10 := int16(d.sig.log10())
	exp := d.exp + l10
	d.exp = -l10

	msd := d.sig.msd2()

	for d.sig[2] == 0 {
		d.sig = d.sig.mul64(10_000_000_000_000_000_000)
		d.exp -= 19
	}

	for d.sig[2] <= 0x0002_7fff_ffff_ffff {
		d.sig = d.sig.mul64(10_000)
		d.exp -= 4
	}

	for d.sig[2] <= 0x18ff_ffff_ffff_ffff {
		d.sig = d.sig.mul64(10)
		d.exp--
	}

	if msd < 10 {
		msd *= 10
	}

	var trunc int8
	if msd > 10 {
		d, trunc = d.quo(decomposed192{
			sig: uint192{uint64(msd), 0, 0},
			exp: -1,
		}, 0)
	}

	_, num, _ := d.sub1(int8(0))
	den, _ := d.add1(int8(0))
	frc, trunc := num.quo(den, trunc)
	sqr, _ := frc.pow2(int8(0))

	res := frc

	for i := uint64(3); i <= 25; i += 2 {
		// res += frc^i / i
		frc, _ = frc.mul(sqr, int8(0))
		tmp, _ := frc.quo(decomposed192{
			sig: uint192{i, 0, 0},
			exp: 0,
		}, int8(0))

		res, trunc = res.add(tmp, trunc)
	}

	expNeg := false
	if exp < 0 {
		exp *= -1
		expNeg = true
	}

	lnExp, _ := ln10.mul(decomposed192{
		sig: uint192{uint64(exp), 0, 0},
		exp: 0,
	}, int8(0))

	res, trunc = res.mul(decomposed192{
		sig: uint192{2, 0, 0},
		exp: 0,
	}, trunc)

	neg := false
	if expNeg {
		neg, res, trunc = res.sub(lnExp, trunc)
	} else {
		res, trunc = res.add(lnExp, trunc)
	}

	if msd > 10 {
		lnMSD := decomposed192{
			sig: ln[msd-11],
			exp: expln,
		}

		if expNeg {
			_, res, trunc = res.sub(lnMSD, trunc)
		} else {
			res, trunc = res.add(lnMSD, trunc)
		}
	}

	return neg, res, trunc
}

func (d decomposed192) log1p(neg bool) (bool, decomposed192, int8) {
	num := d
	res := d

	var trunc int8
	for i := uint64(2); i <= 10; i++ {
		num, trunc = num.mul(d, trunc)
		tmp, _ := num.quo(decomposed192{
			sig: uint192{i, 0, 0},
			exp: 0,
		}, int8(0))

		if i%2 == 0 {
			if neg {
				res, trunc = res.add(tmp, trunc)
			} else {
				_, res, trunc = res.sub(tmp, trunc)
			}
		} else {
			res, trunc = res.add(tmp, trunc)
		}
	}

	return neg, res, trunc
}

func (d decomposed192) mul(o decomposed192, trunc int8) (decomposed192, int8) {
	sig384 := d.sig.mul(o.sig)
	exp := d.exp + o.exp

	for sig384[5] > 0 {
		var rem uint64
		sig384, rem = sig384.div1e19()
		exp += 19

		if rem != 0 {
			trunc = 1
		}
	}

	for sig384[4] > 0 {
		var rem uint64
		sig384, rem = sig384.div1e19()
		exp += 19

		if rem != 0 {
			trunc = 1
		}
	}

	sig256 := uint256{sig384[0], sig384[1], sig384[2], sig384[3]}

	for sig256[3] >= 0x0000_0000_0fff_ffff {
		var rem uint64
		sig256, rem = sig256.div1e8()
		exp += 8

		if rem != 0 {
			trunc = 1
		}
	}

	for sig256[3] >= 0x0000_0000_0000_ffff {
		var rem uint64
		sig256, rem = sig256.div10000()
		exp += 4

		if rem != 0 {
			trunc = 1
		}
	}

	for sig256[3] > 0 {
		var rem uint64
		sig256, rem = sig256.div10()
		exp++

		if rem != 0 {
			trunc = 1
		}
	}

	return decomposed192{
		sig: uint192{sig256[0], sig256[1], sig256[2]},
		exp: exp,
	}, trunc
}

func (d decomposed192) pow2(trunc int8) (decomposed192, int8) {
	sig384 := d.sig.pow2()
	exp := d.exp * 2

	for sig384[5] > 0 {
		var rem uint64
		sig384, rem = sig384.div1e19()
		exp += 19

		if rem != 0 {
			trunc = 1
		}
	}

	for sig384[4] > 0 {
		var rem uint64
		sig384, rem = sig384.div1e19()
		exp += 19

		if rem != 0 {
			trunc = 1
		}
	}

	sig256 := uint256{sig384[0], sig384[1], sig384[2], sig384[3]}

	for sig256[3] >= 0x0000_0000_0000_ffff {
		var rem uint64
		sig256, rem = sig256.div10000()
		exp += 4

		if rem != 0 {
			trunc = 1
		}
	}

	for sig256[3] > 0 {
		var rem uint64
		sig256, rem = sig256.div10()
		exp++

		if rem != 0 {
			trunc = 1
		}
	}

	return decomposed192{
		sig: uint192{sig256[0], sig256[1], sig256[2]},
		exp: exp,
	}, trunc
}

func (d decomposed192) powexp10(o int16, trunc int8) (decomposed192, int8) {
	var p10 int64
	switch o {
	case 0:
		return d, trunc
	case 1:
		p10 = 10
	case 2:
		p10 = 100
	case 3:
		p10 = 1_000
	case 4:
		p10 = 10_000
	case 5:
		p10 = 100_000
	case 6:
		p10 = 1_000_000
	case 7:
		p10 = 10_000_000
	case 8:
		return dinf, trunc
	}

	rtrunc := trunc
	r := decomposed192{
		sig: uint192{1, 0, 0},
		exp: 0,
	}

	for p10 > 1 {
		if int64(d.exp)*2 > math.MaxInt16-58*2 {
			return dinf, trunc
		}

		if p10&1 != 0 {
			r, rtrunc = d.mul(r, rtrunc)
			p10--
		}

		d, trunc = d.mul(d, trunc)
		p10 /= 2
	}

	if int64(d.exp)+int64(r.exp) > math.MaxInt16 {
		return dinf, trunc
	}

	if rtrunc != 0 {
		trunc = 1
	}

	return d.mul(r, trunc)
}

func (d decomposed192) quo(o decomposed192, trunc int8) (decomposed192, int8) {
	if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
		return decomposed192{
			sig: uint192{},
			exp: 0,
		}, trunc
	}

	for d.sig[2] == 0 {
		d.sig = d.sig.mul64(10_000_000_000_000_000_000)
		d.exp -= 19
	}

	for d.sig[2] <= 0x0002_7fff_ffff_ffff {
		d.sig = d.sig.mul64(10_000)
		d.exp -= 4
	}

	for d.sig[2] <= 0x18ff_ffff_ffff_ffff {
		d.sig = d.sig.mul64(10)
		d.exp--
	}

	for o.sig[2] >= 0x18ff_ffff_ffff_ffff {
		var rem uint64
		o.sig, rem = o.sig.div10()
		o.exp++

		if rem != 0 {
			trunc = 1
		}
	}

	sig, rem := d.sig.div(o.sig)
	exp := d.exp - o.exp

	for rem[0]|rem[1]|rem[2] != 0 && sig[2] <= 0x18ff_ffff_ffff_ffff {
		for rem[2] <= 0x0002_7fff_ffff_ffff && sig[2] <= 0x0002_7fff_ffff_ffff {
			rem = rem.mul64(10_000)
			sig = sig.mul64(10_000)
			exp -= 4
		}

		for rem[2] <= 0x18ff_ffff_ffff_ffff && sig[2] <= 0x18ff_ffff_ffff_ffff {
			rem = rem.mul64(10)
			sig = sig.mul64(10)
			exp--
		}

		var tmp uint192
		tmp, rem = rem.div(o.sig)
		sig256 := sig.add(tmp)

		for sig256[3] != 0 {
			var rem uint64
			sig256, rem = sig256.div10()
			exp++

			if rem != 0 {
				trunc = 1
			}
		}

		sig = uint192{sig256[0], sig256[1], sig256[2]}
	}

	if rem[0]|rem[1]|rem[2] != 0 {
		trunc = 1
	}

	return decomposed192{
		sig: sig,
		exp: exp,
	}, trunc
}

func (d decomposed192) rcp(trunc int8) (decomposed192, int8) {
	oneSig := uint192{0x4a00_0000_0000_0000, 0xebfd_cb54_864a_da83, 0x28c8_7cb5_c89a_2571}

	for d.sig[2] >= 0x18ff_ffff_ffff_ffff {
		var rem uint64
		d.sig, rem = d.sig.div10()
		d.exp++

		if rem != 0 {
			trunc = 1
		}
	}

	sig, rem := oneSig.div(d.sig)
	exp := -57 - d.exp

	for rem[0]|rem[1]|rem[2] != 0 && sig[2] <= 0x18ff_ffff_ffff_ffff {
		for rem[2] <= 0x0002_7fff_ffff_ffff && sig[2] <= 0x0002_7fff_ffff_ffff {
			rem = rem.mul64(10_000)
			sig = sig.mul64(10_000)
			exp -= 4
		}

		for rem[2] <= 0x18ff_ffff_ffff_ffff && sig[2] <= 0x18ff_ffff_ffff_ffff {
			rem = rem.mul64(10)
			sig = sig.mul64(10)
			exp--
		}

		var tmp uint192
		tmp, rem = rem.div(d.sig)
		sig256 := sig.add(tmp)

		for sig256[3] != 0 {
			var rem uint64
			sig256, rem = sig256.div10()
			exp++

			if rem != 0 {
				trunc = 1
			}
		}

		sig = uint192{sig256[0], sig256[1], sig256[2]}
	}

	if rem[0]|rem[1]|rem[2] != 0 {
		trunc = 1
	}

	return decomposed192{
		sig: sig,
		exp: exp,
	}, trunc
}

func (d decomposed192) sub(o decomposed192, trunc int8) (bool, decomposed192, int8) {
	exp := d.exp - o.exp

	if exp < 0 {
		for exp <= -19 && o.sig[2] == 0 {
			o.sig = o.sig.mul64(10_000_000_000_000_000_000)
			o.exp -= 19
			exp += 19
		}

		for exp <= -4 && o.sig[2] <= 0x0002_7fff_ffff_ffff {
			o.sig = o.sig.mul64(10_000)
			o.exp -= 4
			exp += 4
		}

		for exp < 0 && o.sig[2] <= 0x18ff_ffff_ffff_ffff {
			o.sig = o.sig.mul64(10)
			o.exp--
			exp++
		}

		if exp < -57 {
			if d.sig[0]|d.sig[1]|d.sig[2] != 0 {
				d.sig = uint192{}
				trunc = 1
			}

			d.exp = o.exp
			exp = 0
		}

		for exp <= -4 {
			var rem uint64
			d.sig, rem = d.sig.div10000()
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				d.exp = o.exp
				exp = 0
			} else {
				d.exp += 4
				exp += 4
			}
		}

		for exp < 0 {
			var rem uint64
			d.sig, rem = d.sig.div10()
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				d.exp = o.exp
				break
			}

			d.exp++
			exp++
		}
	} else if exp > 0 {
		for exp >= 19 && d.sig[2] == 0 {
			d.sig = d.sig.mul64(10_000_000_000_000_000_000)
			d.exp -= 19
			exp -= 19
		}

		for exp >= 4 && d.sig[2] <= 0x0002_7fff_ffff_ffff {
			d.sig = d.sig.mul64(10_000)
			d.exp -= 4
			exp -= 4
		}

		for exp > 0 && d.sig[2] <= 0x18ff_ffff_ffff_ffff {
			d.sig = d.sig.mul64(10)
			d.exp--
			exp--
		}

		if exp > 57 {
			if o.sig[0]|o.sig[1]|o.sig[2] != 0 {
				o.sig = uint192{}
				trunc = -1
			}

			exp = 0
		}

		for exp >= 4 {
			var rem uint64
			o.sig, rem = o.sig.div10000()
			if rem != 0 {
				trunc = -1
			}

			if o.sig[0]|o.sig[1]|o.sig[2] == 0 {
				exp = 0
			} else {
				exp -= 4
			}
		}

		for exp > 0 {
			var rem uint64
			o.sig, rem = o.sig.div10()
			if rem != 0 {
				trunc = -1
			}

			if o.sig[0]|o.sig[1]|o.sig[2] == 0 {
				break
			}

			exp--
		}
	}

	neg := false
	sig, brw := d.sig.sub(o.sig)
	exp = d.exp

	if brw != 0 {
		sig = sig.twos()
		neg = true
		trunc *= -1
	}

	return neg, decomposed192{
		sig: sig,
		exp: exp,
	}, trunc
}

func (d decomposed192) sub1(trunc int8) (bool, decomposed192, int8) {
	if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
		return true, decomposed192{
			sig: uint192{1, 0, 0},
			exp: 0,
		}, trunc
	}

	if d.exp < -116 {
		return true, decomposed192{
			sig: uint192{1, 0, 0},
			exp: 0,
		}, 1
	}

	if d.exp > 58 {
		return false, d, 1
	}

	var sig uint192
	var brw uint

	if d.exp <= 0 {
		for d.exp < -62 {
			var rem uint64
			d.sig, rem = d.sig.div10000()
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				return true, decomposed192{
					sig: uint192{1, 0, 0},
					exp: 0,
				}, trunc
			}

			d.exp += 4
		}

		for d.exp < -57 {
			var rem uint64
			d.sig, rem = d.sig.div10()
			d.exp++
			if rem != 0 {
				trunc = 1
			}

			if d.sig[0]|d.sig[1]|d.sig[2] == 0 {
				return true, decomposed192{
					sig: uint192{1, 0, 0},
					exp: 0,
				}, trunc
			}
		}

		sig, brw = d.sig.sub(uint192PowersOf10[-d.exp])
	} else {
		for d.exp > 4 && d.sig[2] <= 0x0002_7fff_ffff_ffff {
			d.sig = d.sig.mul64(10_000)
			d.exp -= 4
		}

		for d.exp > 0 && d.sig[2] <= 0x18ff_ffff_ffff_ffff {
			d.sig = d.sig.mul64(10)
			d.exp--
		}

		if d.exp != 0 {
			return false, d, 1
		}

		sig, brw = d.sig.sub(uint192{1, 0, 0})
	}

	neg := false

	if brw != 0 {
		sig = sig.twos()
		neg = true
		trunc *= -1
	}

	return neg, decomposed192{
		sig: sig,
		exp: d.exp,
	}, trunc
}
